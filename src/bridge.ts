import Fastify from "fastify";
import { CONFIG } from "./config.js";

const fastify = Fastify({ logger: true });

fastify.get("/healthz", async () => {
  return { status: "ok", bridge: "claudeep-local-bridge" };
});

fastify.get("/v1/models", async () => {
  const response = await fetch(`http://${CONFIG.GATEWAY_HOST}:${CONFIG.GATEWAY_PORT}/v1/models`);
  return await response.json();
});

fastify.post("/v1/messages/count_tokens", async () => {
  return { input_tokens: 120 };
});

fastify.post("/v1/messages", async (request, reply) => {
  try {
    const gatewayUrl = `http://${CONFIG.GATEWAY_HOST}:${CONFIG.GATEWAY_PORT}/v1/messages`;
    const gatewayRes = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": request.headers.authorization || "Bearer local-bridge-token"
      },
      body: JSON.stringify(request.body)
    });

    const isStreaming = (request.body as any)?.stream;

    if (isStreaming && gatewayRes.body) {
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.flushHeaders?.();

      const reader = gatewayRes.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(value);
        }
      } finally {
        reply.raw.end();
      }
      return reply;
    } else {
      const data = await gatewayRes.json();
      return reply.code(gatewayRes.status).send(data);
    }
  } catch (err: any) {
    request.log.error(err);
    return reply.code(502).send({
      type: "error",
      error: {
        message: `Local bridge failed to reach gateway at ${CONFIG.GATEWAY_HOST}:${CONFIG.GATEWAY_PORT}. Ensure gateway is running via ./run-claudeep.sh: ${err.message}`,
        type: "api_error"
      }
    });
  }
});

const startBridge = async () => {
  await fastify.listen({ port: CONFIG.BRIDGE_PORT, host: CONFIG.GATEWAY_HOST });
  console.log(`Claudeep Local Protocol Bridge running at http://${CONFIG.GATEWAY_HOST}:${CONFIG.BRIDGE_PORT}`);
};

startBridge().catch(err => {
  console.error(err);
  process.exit(1);
});
