#!/bin/bash
# Claudeep Launcher Script
# Starts Gateway, Worker, Bridge, and launches Claude Code CLI pointing to DeepSeek browser backend via Secretbase / local gateway.

cd /home/ultraclaude/claudeep

# Kill any previous claudeep processes
pkill -f "dist/gateway.js" 2>/dev/null
pkill -f "dist/bridge.js" 2>/dev/null
pkill -f "dist/worker.js" 2>/dev/null

echo "Starting Claudeep Gateway (port 9080)..."
node dist/gateway.js &
GATEWAY_PID=$!

echo "Starting Claudeep Local Bridge (port 4142)..."
node dist/bridge.js &
BRIDGE_PID=$!

echo "Starting Playwright Browser Worker (connected to DeepSeek)..."
node dist/worker.js &
WORKER_PID=$!

sleep 2

echo "======================================================="
echo "Claudeep stack is running locally!"
echo "Gateway PID: $GATEWAY_PID"
echo "Bridge PID:  $BRIDGE_PID"
echo "Worker PID:  $WORKER_PID"
echo "======================================================="
echo "Launching Claude Code CLI..."

export ANTHROPIC_BASE_URL="http://127.0.0.1:4142"
export ANTHROPIC_AUTH_TOKEN="local-bridge-token"
unset ANTHROPIC_API_KEY

# Run Claude Code CLI instance with deepseek-browser
claude --model deepseek-browser --dangerously-skip-permissions

# Cleanup on exit
kill $GATEWAY_PID $BRIDGE_PID $WORKER_PID 2>/dev/null
