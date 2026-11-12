import { spawn } from "child_process";
const rootDir = process.cwd();
function startService(name, script) {
    console.log(`[Ultraclaude Daemon] Starting ${name}...`);
    const proc = spawn("node", [script], { cwd: rootDir, stdio: "inherit" });
    proc.on("exit", (code) => {
        console.log(`[Ultraclaude Daemon] ${name} exited with code ${code}. Restarting in 3s...`);
        setTimeout(() => startService(name, script), 3000);
    });
    return proc;
}
console.log("[Ultraclaude Daemon] Starting Ultraclaude stack supervision with sequenced startup...");
startService("Gateway", "dist/gateway.js");
setTimeout(() => {
    startService("Bridge", "dist/bridge.js");
}, 2000);
setTimeout(() => {
    startService("Worker", "dist/worker.js");
}, 4000);
