# Claudeep Universal Agentic Terminal Runtime

Universal agentic AI runtime connecting Claude Code CLI to DeepSeek browser backend via local protocol bridge, control plane gateway, and headless Playwright worker with **Deep Think / high-effort reasoning** and **reboot persistence**.

## Zero-Friction Setup on Any New Machine ("Voila")

1. **Clone the repository** on the new machine:
   ```bash
   git clone <repo-url> claudeep
   cd claudeep
   ```

2. **Configure credentials** (or let bootstrap use defaults):
   Create or edit `.env`:
   ```env
   DEEPSEEK_USERNAME=james.gonzales.1985@gmail.com
   DEEPSEEK_PASSWORD=batmanbegins
   ```

3. **Run the universal bootstrap script**:
   ```bash
   ./bootstrap.sh
   ```
   *This automatically installs Node dependencies, installs Playwright Chromium, builds the project, and registers a systemd daemon service that runs headlessly in the background and restarts automatically on reboot.*

4. **Use Claude Code CLI**:
   ```bash
   export ANTHROPIC_BASE_URL="http://127.0.0.1:4142"
   export ANTHROPIC_AUTH_TOKEN="local-bridge-token"
   claude --model deepseek-browser
   ```
