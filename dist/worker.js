import { chromium } from "playwright";
import { WebSocket } from "ws";
import { CONFIG } from "./config.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
class DeepSeekWorker {
    ws = null;
    context = null;
    page = null;
    async start() {
        console.log("Starting DeepSeek Browser Worker with Agentic Harness...");
        if (!fs.existsSync(CONFIG.PROFILE_PATH)) {
            fs.mkdirSync(CONFIG.PROFILE_PATH, { recursive: true });
        }
        this.context = await chromium.launchPersistentContext(CONFIG.PROFILE_PATH, {
            headless: CONFIG.HEADLESS,
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            ignoreDefaultArgs: ["--enable-automation"],
            args: [
                "--start-maximized",
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--disable-dev-shm-usage"
            ]
        });
        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
        // Advanced stealth evasion against bot detection in headless mode
        await this.page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        });
        // Connect gateway immediately
        this.connectGateway();
        console.log(`Navigating to ${CONFIG.DEEPSEEK_URL}...`);
        await this.page.goto(CONFIG.DEEPSEEK_URL, { waitUntil: "domcontentloaded" });
        await this.ensureAuthenticated();
    }
    async ensureAuthenticated() {
        if (!this.page)
            return;
        try {
            console.log("Checking authentication state on DeepSeek...");
            await this.page.waitForTimeout(4000);
            // If already on chat (textarea present), we're authenticated
            let chatTextarea = await this.page.$('textarea, div[contenteditable="true"]');
            if (chatTextarea) {
                console.log("Browser session appears authenticated (chat textarea present).");
                return;
            }
            // Check for Cloudflare / Security check "Begin" button
            const buttonsBefore = await this.page.$$('button, div.ds-button');
            for (const b of buttonsBefore) {
                const t = (await b.textContent())?.trim();
                if (t === "Begin") {
                    console.log("Found Cloudflare security check 'Begin' button. Clicking it...");
                    await b.click().catch(() => { });
                    await this.page.waitForTimeout(5000);
                    break;
                }
            }
            // Navigate to DeepSeek root if not there
            if (!this.page.url().includes("chat.deepseek.com")) {
                await this.page.goto(CONFIG.DEEPSEEK_URL, { waitUntil: "domcontentloaded" });
                await this.page.waitForTimeout(4000);
            }
            chatTextarea = await this.page.$('textarea, div[contenteditable="true"]');
            if (chatTextarea) {
                console.log("Browser session appears authenticated.");
                return;
            }
            console.log("Login required. Navigating to sign_in...");
            await this.page.goto("https://chat.deepseek.com/sign_in", { waitUntil: "domcontentloaded" });
            await this.page.waitForTimeout(4000);
            const emailInput = await this.page.$('input[placeholder*="email" i], input[placeholder*="phone" i], input[type="text"], input[type="email"]');
            if (emailInput) {
                await emailInput.fill(CONFIG.CREDENTIALS.username);
                console.log("Filled email/username.");
            }
            const passwordInput = await this.page.$('input[type="password"]');
            if (passwordInput) {
                await passwordInput.fill(CONFIG.CREDENTIALS.password);
                console.log("Filled password.");
            }
            // Check terms checkbox if present
            const checkbox = await this.page.$('input[type="checkbox"]');
            if (checkbox) {
                const isChecked = await checkbox.isChecked().catch(() => false);
                if (!isChecked) {
                    await checkbox.click().catch(() => { });
                    console.log("Checked terms agreement checkbox.");
                }
            }
            await this.page.waitForTimeout(1000);
            // Click Log in / Sign in button
            const btns = await this.page.$$('div.ds-button, button');
            for (const b of btns) {
                const t = (await b.textContent())?.trim();
                if (/log\s*in|sign\s*in|登录/i.test(t || '')) {
                    await b.click().catch(() => { });
                    console.log("Clicked login button:", t);
                    break;
                }
            }
            await this.page.waitForTimeout(5000);
            // Click "Send code" if verification screen appears
            const sendCodeBtns = await this.page.$$('div.ds-button, button');
            for (const b of sendCodeBtns) {
                const t = (await b.textContent())?.trim();
                if (t === "Send code") {
                    await b.click().catch(() => { });
                    console.log("Clicked Send code. Waiting for manual verification code entry if needed...");
                    break;
                }
            }
            // Wait for chat textarea
            console.log("Waiting for authentication to complete (up to 3 minutes)...");
            for (let i = 0; i < 180; i++) {
                const btnsLoop = await this.page.$$('button, div.ds-button');
                for (const b of btnsLoop) {
                    const t = (await b.textContent())?.trim();
                    if (t === "Begin") {
                        await b.click().catch(() => { });
                        console.log("Clicked recurring 'Begin' button.");
                    }
                }
                const ta = await this.page.$('textarea, div[contenteditable="true"]');
                if (ta) {
                    console.log("Authentication successful - chat ready.");
                    return;
                }
                await this.page.waitForTimeout(1000);
            }
            console.log("WARNING: Authentication not confirmed within timeout. Continuing anyway.");
        }
        catch (err) {
            console.log("Auth check notice:", err);
        }
    }
    connectGateway() {
        const wsUrl = `ws://127.0.0.1:${CONFIG.GATEWAY_PORT + 1}/worker/connect`;
        console.log(`Connecting worker to gateway at ${wsUrl}...`);
        this.ws = new WebSocket(wsUrl);
        this.ws.on("open", () => {
            console.log("Connected to Claudeep Gateway successfully.");
            this.ws?.send(JSON.stringify({
                type: "worker.register",
                workerId: "local-browser-worker",
                capabilities: { browser: "chromium", streaming: true, interactiveLogin: true, agenticHarness: true }
            }));
        });
        this.ws.on("message", async (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === "job.execute") {
                    console.log(`Executing agentic job ${msg.requestId}...`);
                    const result = await this.executeAgenticLoop(msg.prompt);
                    this.ws?.send(JSON.stringify({
                        type: "job.result",
                        requestId: msg.requestId,
                        result
                    }));
                    console.log(`Job ${msg.requestId} completed and sent.`);
                }
            }
            catch (err) {
                console.error("Error processing gateway job:", err);
            }
        });
        this.ws.on("close", () => {
            console.log("Disconnected from gateway. Reconnecting in 5 seconds...");
            setTimeout(() => this.connectGateway(), 5000);
        });
        this.ws.on("error", (err) => {
            console.error("WebSocket error:", err);
        });
    }
    async executeAgenticLoop(prompt) {
        if (!this.page)
            throw new Error("Browser page not initialized");
        try {
            await this.sendToChat(prompt);
            let finalResponse = "";
            for (let turn = 0; turn < 5; turn++) {
                const responseText = await this.waitForResponseStabilization();
                finalResponse = responseText;
                const executedAction = await this.parseAndExecuteActions(responseText);
                if (executedAction) {
                    console.log(`[Agentic Harness] Executed ${executedAction.type}: ${executedAction.output}. Feeding result back to DeepSeek...`);
                    const feedbackPrompt = `[Tool Execution Result]\n${executedAction.output}\nPlease continue building or answering.`;
                    await this.sendToChat(feedbackPrompt);
                    continue;
                }
                else {
                    break;
                }
            }
            return finalResponse;
        }
        catch (err) {
            console.error("Failed in agentic loop:", err);
            return `<DS_FINAL>\nError in agentic execution loop: ${err.message}\n</DS_FINAL>`;
        }
    }
    async sendToChat(text) {
        if (!this.context)
            throw new Error("Browser context not initialized");
        if (!this.page || this.page.isClosed()) {
            const pages = this.context.pages();
            this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
        }
        if (!this.page.url().includes("chat.deepseek.com")) {
            await this.page.goto(CONFIG.DEEPSEEK_URL, { waitUntil: "domcontentloaded" });
            await this.page.waitForTimeout(3000);
        }
        const inputSelector = 'textarea, div[contenteditable="true"]';
        try {
            await this.page.waitForSelector(inputSelector, { timeout: 10000 });
        }
        catch {
            await this.ensureAuthenticated();
            await this.page.waitForSelector(inputSelector, { timeout: 15000 });
        }
        await this.page.click(inputSelector);
        await this.page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) {
                if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
                    el.value = '';
                }
                else {
                    el.innerHTML = '';
                }
            }
        }, inputSelector);
        await this.page.type(inputSelector, text, { delay: 1 });
        // Always activate Deep Think / high effort reasoning mode
        try {
            const clickables = await this.page.$$('button, div[role="button"], span, div.ds-button');
            for (const el of clickables) {
                const textContent = (await el.textContent() || '').trim();
                const ariaLabel = await el.getAttribute('aria-label') || '';
                if (/deep\s*think|think|reasoning|思考|深度/i.test(textContent) || /deep\s*think|think|reasoning/i.test(ariaLabel)) {
                    await el.click().catch(() => { });
                    console.log("[DeepSeek Worker] Activated Deep Think (reasoning mode).");
                    break;
                }
            }
        }
        catch (err) {
            // ignore if not found
        }
        const sendButton = await this.page.$('button[type="submit"], button:has(svg), div[role="button"]:has(svg)');
        if (sendButton) {
            await sendButton.click().catch(() => { });
        }
        else {
            await this.page.keyboard.press("Enter");
        }
    }
    async waitForResponseStabilization() {
        if (!this.page)
            return "";
        let previousText = "";
        let stableCount = 0;
        for (let i = 0; i < 60; i++) {
            await this.page.waitForTimeout(1000);
            const currentText = await this.page.evaluate(() => {
                const elements = document.querySelectorAll('.ds-markdown, .flet-message, [class*="message"], [class*="markdown"]');
                if (elements.length > 0) {
                    return elements[elements.length - 1].textContent || "";
                }
                return document.body.innerText;
            });
            if (currentText === previousText && currentText.trim().length > 0) {
                stableCount++;
                if (stableCount >= 2) {
                    break;
                }
            }
            else {
                stableCount = 0;
                previousText = currentText;
            }
        }
        return previousText;
    }
    async parseAndExecuteActions(text) {
        const fileMatch = text.match(/```[a-zA-Z-]*\s+(?:filename=["']([^"']+)["']|file=["']([^"']+)["']|\/\/\s*file:\s*([^\n]+)|#\s*file:\s*([^\n]+))\s*\n([\s\S]*?)\s*```/);
        if (fileMatch) {
            const filePath = (fileMatch[1] || fileMatch[2] || fileMatch[3] || fileMatch[4] || "").trim();
            const fileContent = fileMatch[5];
            if (filePath) {
                try {
                    const dir = path.dirname(filePath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(filePath, fileContent.trim(), 'utf8');
                    return { type: "Write", output: `Successfully wrote file ${filePath}` };
                }
                catch (err) {
                    return { type: "Write", output: `Failed to write file ${filePath}: ${err.message}` };
                }
            }
        }
        const bashMatch = text.match(/```(?:bash|sh|shell)\s*([\s\S]*?)\s*```/);
        if (bashMatch) {
            const cmd = bashMatch[1].trim();
            if (cmd && !cmd.startsWith('{')) {
                try {
                    console.log(`[Agentic Harness] Executing shell command: ${cmd}`);
                    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
                    return { type: "Bash", output: `Command executed successfully:\n${output}` };
                }
                catch (err) {
                    return { type: "Bash", output: `Command failed with error: ${err.message}\nstdout: ${err.stdout || ''}\nstderr: ${err.stderr || ''}` };
                }
            }
        }
        return null;
    }
}
const worker = new DeepSeekWorker();
worker.start().catch(err => {
    console.error("Worker failed to start:", err);
    process.exit(1);
});
