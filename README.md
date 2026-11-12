# ULTRACLAUDE

The pinnacle of Antiglaude and Claudeep: Universal agentic AI runtime connecting any CLI agent (Claude Code CLI, OpenCode, Codex, etc.) to DeepSeek's browser reasoning backend via a local protocol bridge, control plane gateway, and headless Playwright worker with **Always-On Deep Think (high-effort reasoning)** and **reboot persistence**.

---

## Architecture

```
Claude Code CLI / OpenCode / Codex
  ↓ (Anthropic Messages API / HTTP)
Local Protocol Bridge (http://127.0.0.1:4142)
  ↓
Control Plane Gateway (http://127.0.0.1:9080)
  ↓ (WebSocket Worker Protocol)
Headless Playwright Worker (Stealth Evasion + Deep Think)
  ↓
DeepSeek Chat (https://chat.deepseek.com)
```

---

## Universal Setup on Any Machine ("Voila")

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jg01091985/ultraclaude.git ultraclaude
   cd ultraclaude
   ```

2. **Configure Credentials**:
   Copy `.env.example` to `.env` and enter your DeepSeek credentials:
   ```env
   DEEPSEEK_USERNAME=your-deepseek-email@example.com
   DEEPSEEK_PASSWORD=your-deepseek-password
   BRIDGE_PORT=4142
   GATEWAY_PORT=9080
   ```

3. **Run the Universal Bootstrap Script**:
   ```bash
   ./bootstrap.sh
   ```
   *This automatically installs Node dependencies, downloads Playwright Chromium & OS system libraries, builds the TypeScript project, registers a systemd user daemon service with reboot persistence, and configures global shell routing (`ANTHROPIC_BASE_URL`).*

4. **One-Time Login / Captcha (if prompted)**:
   If DeepSeek requires an initial login or Cloudflare check, run once in headed mode:
   ```bash
   npm run login
   ```
   *Complete the login / captcha in the browser window once; your session cookies are permanently cached in the persistent profile.*

5. **Use Anywhere**:
   Open any terminal and run:
   ```bash
   ultraclaude --dangerously-skip-permissions
   ```
   *It automatically routes through Ultraclaude with Deep Think enabled, sets up environment routing, and runs the DeepSeek browser backend!*

   **Model Routing Examples**:
   - DeepSeek Browser + Deep Think: `ultraclaude --model deepseek --dangerously-skip-permissions` (or simply `ultraclaude`)
   - Gemini API Routing: `ultraclaude --model gemini-3-flash --dangerously-skip-permissions`
   - Claude Thinking Routing: `ultraclaude --model claude-sonnet-4.6 --dangerously-skip-permissions`
