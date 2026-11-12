# Claudeep

Claude Code running on your local machine backed by DeepSeek browser reasoning, coordinated via Secretbase-compatible local gateway and Playwright worker.

## Architecture

```
Claude Code CLI
  ↓ (Anthropic Messages API)
Local Protocol Bridge (http://127.0.0.1:4141)
  ↓ (HTTP / WebSocket)
Control Plane Gateway (http://127.0.0.1:8080)
  ↓ (WebSocket worker connection)
Browser Worker (Playwright + Persistent Profile)
  ↓
DeepSeek Chat (https://chat.deepseek.com)
```

## Setup & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Gateway:
   ```bash
   npm run start:gateway
   ```

3. Start the Browser Worker (launches persistent Chromium profile, logs in with `james.gonzales.1985@gmail.com`):
   ```bash
   npm run start:worker
   ```

4. Start the Local Protocol Bridge:
   ```bash
   npm run start:bridge
   ```

5. Configure and run Claude Code:
   ```bash
   export ANTHROPIC_BASE_URL="http://127.0.0.1:4141"
   export ANTHROPIC_AUTH_TOKEN="local-bridge-token"
   claude --model deepseek-browser
   ```
