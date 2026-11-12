import Fastify from "fastify";
import { WebSocketServer, WebSocket } from "ws";
import { CONFIG } from "./config.js";
import { compilePrompt } from "./prompt-compiler.js";
import { parseBrowserOutput, normalizeToolName } from "./parser.js";
import { redactSecrets, browserCircuitBreaker, checkIdempotency, completeIdempotency } from "./hardening.js";
const fastify = Fastify({ logger: true });
let activeWorkerSocket = null;
const pendingRequests = new Map();
fastify.get("/healthz", async () => {
    return {
        status: "ok",
        workerConnected: activeWorkerSocket !== null,
        circuitBreaker: browserCircuitBreaker.canExecute() ? "CLOSED_OR_HALF_OPEN" : "OPEN"
    };
});
fastify.get("/v1/models", async () => {
    return {
        object: "list",
        data: [
            { id: "deepseek", object: "model", owned_by: "deepseek" },
            { id: "deepseek-reasoner", object: "model", owned_by: "deepseek" },
            { id: "deepseek-chat", object: "model", owned_by: "deepseek" },
            { id: "deepseek-browser", object: "model", owned_by: "deepseek" },
            { id: "claude-sonnet-4.6", object: "model", owned_by: "anthropic" },
            { id: "claude-opus-4.6", object: "model", owned_by: "anthropic" },
            { id: "gemini-3-flash", object: "model", owned_by: "google" },
            { id: "gemini-2.5-pro", object: "model", owned_by: "google" }
        ]
    };
});
fastify.post("/v1/messages/count_tokens", async () => {
    return { input_tokens: 120 };
});
fastify.post("/v1/messages", async (request, reply) => {
    if (!browserCircuitBreaker.canExecute()) {
        return reply.code(503).send({
            type: "error",
            error: {
                message: "Browser backend circuit breaker is OPEN due to repeated failures.",
                type: "overloaded_error"
            }
        });
    }
    const body = request.body;
    const { messages, system, tools, stream } = body;
    if (!activeWorkerSocket || activeWorkerSocket.readyState !== WebSocket.OPEN) {
        return reply.code(503).send({
            type: "error",
            error: {
                message: "No browser worker connected to Claudeep gateway. Please run ./run-claudeep.sh to start the worker stack.",
                type: "api_error"
            }
        });
    }
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const prompt = redactSecrets(compilePrompt(system, messages, tools || []));
    if (checkIdempotency(requestId, prompt)) {
        return reply.code(409).send({ type: "error", error: { message: "Duplicate idempotent request", type: "invalid_request_error" } });
    }
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                browserCircuitBreaker.recordFailure();
                reject(new Error("Browser worker generation timeout (DeepSeek chat took >120s)"));
            }
        }, 120000);
        pendingRequests.set(requestId, {
            resolve: async (browserResponse) => {
                clearTimeout(timeout);
                completeIdempotency(requestId);
                browserCircuitBreaker.recordSuccess();
                const sanitizedResponse = redactSecrets(browserResponse);
                const parsed = parseBrowserOutput(sanitizedResponse);
                let toolUseBlock = null;
                let textContent = sanitizedResponse;
                if (parsed.type === 'tool_call' && parsed.toolCall) {
                    const normalizedName = normalizeToolName(parsed.toolCall.name);
                    toolUseBlock = {
                        type: "tool_use",
                        id: parsed.toolCall.id,
                        name: normalizedName,
                        input: parsed.toolCall.input
                    };
                    textContent = sanitizedResponse.replace(/<DS_TOOL_CALL>[\s\S]*?<\/DS_TOOL_CALL>/, "").trim();
                }
                else if (parsed.type === 'final') {
                    textContent = parsed.text || sanitizedResponse;
                }
                if (stream) {
                    reply.raw.setHeader("Content-Type", "text/event-stream");
                    reply.raw.setHeader("Cache-Control", "no-cache");
                    reply.raw.setHeader("Connection", "keep-alive");
                    reply.raw.flushHeaders?.();
                    const sendEvent = (event, data) => {
                        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                    };
                    const msgId = `msg_${Date.now()}`;
                    sendEvent("message_start", {
                        type: "message_start",
                        message: {
                            id: msgId,
                            type: "message",
                            role: "assistant",
                            content: [],
                            model: body.model || "deepseek-browser",
                            stop_reason: null,
                            usage: { input_tokens: 150, output_tokens: 1 }
                        }
                    });
                    sendEvent("content_block_start", {
                        type: "content_block_start",
                        index: 0,
                        content_block: { type: "text", text: "" }
                    });
                    const chunkSize = 20;
                    for (let i = 0; i < textContent.length; i += chunkSize) {
                        const chunk = textContent.slice(i, i + chunkSize);
                        sendEvent("content_block_delta", {
                            type: "content_block_delta",
                            index: 0,
                            delta: { type: "text_delta", text: chunk }
                        });
                        await new Promise(r => setTimeout(r, 10));
                    }
                    sendEvent("content_block_stop", { type: "content_block_stop", index: 0 });
                    if (toolUseBlock) {
                        sendEvent("content_block_start", {
                            type: "content_block_start",
                            index: 1,
                            content_block: toolUseBlock
                        });
                        sendEvent("content_block_stop", { type: "content_block_stop", index: 1 });
                    }
                    sendEvent("message_delta", {
                        type: "message_delta",
                        delta: {
                            stop_reason: toolUseBlock ? "tool_use" : "end_turn",
                            stop_sequence: null
                        },
                        usage: { output_tokens: 100 }
                    });
                    sendEvent("message_stop", { type: "message_stop" });
                    reply.raw.write("data: [DONE]\n\n");
                    reply.raw.end();
                    resolve(reply);
                }
                else {
                    const content = [{ type: "text", text: textContent }];
                    if (toolUseBlock)
                        content.push(toolUseBlock);
                    const responseObj = {
                        id: requestId,
                        type: "message",
                        role: "assistant",
                        model: body.model || "deepseek-browser",
                        content,
                        stop_reason: toolUseBlock ? "tool_use" : "end_turn",
                        usage: { input_tokens: 150, output_tokens: 100 }
                    };
                    resolve(reply.code(200).send(responseObj));
                }
            },
            reject: (err) => {
                clearTimeout(timeout);
                browserCircuitBreaker.recordFailure();
                reject(err);
            }
        });
        activeWorkerSocket.send(JSON.stringify({
            type: "job.execute",
            requestId,
            prompt
        }));
    }).catch((err) => {
        browserCircuitBreaker.recordFailure();
        const statusCode = err.message?.includes("timeout") ? 504 : 500;
        return reply.code(statusCode).send({
            type: "error",
            error: {
                message: err.message || "Browser worker error",
                type: "api_error"
            }
        });
    });
});
const startGateway = async () => {
    await fastify.listen({ port: CONFIG.GATEWAY_PORT, host: CONFIG.GATEWAY_HOST });
    console.log(`Claudeep Gateway running at http://${CONFIG.GATEWAY_HOST}:${CONFIG.GATEWAY_PORT} (with Hardening)`);
    const wss = new WebSocketServer({ port: CONFIG.GATEWAY_PORT + 1 });
    console.log(`Claudeep Worker WebSocket server running at ws://${CONFIG.GATEWAY_HOST}:${CONFIG.GATEWAY_PORT + 1}/worker/connect`);
    wss.on("connection", (ws) => {
        console.log("Browser worker connected");
        activeWorkerSocket = ws;
        ws.on("message", (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === "job.result") {
                    const pending = pendingRequests.get(msg.requestId);
                    if (pending) {
                        pendingRequests.delete(msg.requestId);
                        pending.resolve(msg.result);
                    }
                }
            }
            catch (err) {
                console.error("Error parsing worker message:", err);
            }
        });
        ws.on("close", () => {
            console.log("Browser worker disconnected");
            if (activeWorkerSocket === ws)
                activeWorkerSocket = null;
        });
    });
};
startGateway().catch(err => {
    console.error(err);
    process.exit(1);
});
