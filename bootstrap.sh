#!/bin/bash
# Claudeep Universal Bootstrap Script
# Sets up dependencies, builds project, configures environment, and sets up systemd persistence across reboots.

set -e
CDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CDIR"

echo "======================================================="
echo "Bootstrapping Claudeep Universal Agentic Runtime..."
echo "======================================================="

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  fi
fi

echo "[1/5] Installing npm dependencies..."
npm install

echo "[2/5] Installing Playwright Chromium browser binary & OS dependencies..."
npx playwright install chromium
sudo -n npx playwright install-deps chromium || echo "Warning: Could not install OS dependencies automatically via sudo (may require manual apt-get install on some headless distros)."

echo "[3/5] Building TypeScript project..."
npm run build

echo "[4/5] Setting up systemd user service for reboot persistence..."
mkdir -p ~/.config/systemd/user
cp claudeep.service ~/.config/systemd/user/ultraclaude.service 2>/dev/null || cp claudeep.service ~/.config/systemd/user/claudeep.service 2>/dev/null || true
systemctl --user daemon-reload || true
systemctl --user enable ultraclaude.service || systemctl --user enable claudeep.service || true
systemctl --user start ultraclaude.service || systemctl --user start claudeep.service || true

echo "[5/5] Installing ultraclaude global CLI wrapper and environment routing..."
sudo cp ultraclaude /usr/local/bin/ultraclaude 2>/dev/null || cp ultraclaude ~/.local/bin/ultraclaude 2>/dev/null || true
chmod +x /usr/local/bin/ultraclaude ~/.local/bin/ultraclaude 2>/dev/null || true

# Add exports to shell rc files if not present
for rc in ~/.bashrc ~/.zshrc; do
  if [ -f "$rc" ]; then
    if ! grep -q "ANTHROPIC_BASE_URL" "$rc"; then
      echo -e "\n# Ultraclaude Routing\nexport ANTHROPIC_BASE_URL=\"http://127.0.0.1:4142\"\nexport ANTHROPIC_AUTH_TOKEN=\"local-bridge-token\"\nunset ANTHROPIC_API_KEY\n" >> "$rc"
    fi
  fi
done

echo "======================================================="
echo "Bootstrap completed successfully! VOILA!"
echo "Claudeep daemon is now running in the background and will"
echo "automatically start on system boot."
echo "To check status: systemctl --user status claudeep.service"
echo "To use Claude Code with DeepSeek browser backend:"
echo "  export ANTHROPIC_BASE_URL=\"http://127.0.0.1:4142\""
echo "  export ANTHROPIC_AUTH_TOKEN=\"local-bridge-token\""
echo "  claude --model deepseek-browser"
echo "======================================================="
