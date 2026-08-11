import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const HOST = "127.0.0.1";
const API_PORT = 5000;
const FRONTEND_PORT = 3000;
const BACKEND_START_TIMEOUT_MS = 40000;
const PROCESS_PREFIX_WIDTH = 14;

const rootDir = process.cwd();
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");
const prefix = (name) => (name + " ").padEnd(PROCESS_PREFIX_WIDTH);
const px = (name) => `\x1b[90m${prefix(name)}\x1b[0m`;

const pythonCandidates = process.platform === "win32"
  ? ["py", "python", "python3"]
  : ["python3", "python", "py"];

function findPython() {
  // Prefer an explicit launcher from env, then probe common candidates.
  if (process.env.PYTHON) return [process.env.PYTHON];
  return pythonCandidates;
}

function waitForPort(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const socket = net.connect({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) return resolve(false);
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

function pipe(child, name) {
  const onData = (chunk) => {
    process.stdout.write(`${px(name)}${chunk}`);
  };
  child.stdout && child.stdout.on("data", onData);
  child.stderr && child.stderr.on("data", onData);
}

async function main() {
  const banner = (text) => console.log(`\x1b[90m--------------------------------------------------------\x1b[0m\n${text}\n\x1b[90m--------------------------------------------------------\x1b[0m`);

  // 1. Start the Python (Flask + Groq) backend.
  const pythonCmd = findPython();
  let backend = null;
  let chosen = null;
  for (const cmd of pythonCmd) {
    try {
      backend = spawn(cmd, ["app.py"], {
        cwd: backendDir,
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, FLASK_DEBUG_RELOAD: "0" },
      });
      chosen = cmd;
      backend.once("error", () => {
        backend = null;
      });
      // If the binary itself is missing, the 'error' event fires on next tick.
      await new Promise((r) => setTimeout(r, 250));
      if (backend) break;
    } catch {
      backend = null;
    }
  }
  if (!backend) {
    console.error("[dev] Could not start Python backend. Install Python 3.10+ and try again.");
    process.exit(1);
  }
  console.log(`[dev] Starting Flask backend with '${chosen} app.py' on http://${HOST}:${API_PORT}`);
  pipe(backend, "backend");

  // 2. Wait for the API to accept connections, then start Vite.
  const ready = await waitForPort(HOST, API_PORT, BACKEND_START_TIMEOUT_MS);
  if (!ready) {
    console.warn(`[dev] Flask did not respond on :${API_PORT} within ${BACKEND_START_TIMEOUT_MS / 1000}s. Starting frontend anyway (backend still booting).`);
  } else {
    banner(`  Backend ready on http://${HOST}:${API_PORT}\n  Starting web frontend on http://${HOST}:${FRONTEND_PORT} ...`);
  }

  const viteBin = path.join(frontendDir, "node_modules", "vite", "bin", "vite.js");
  const frontend = spawn(process.execPath, [viteBin, "--host", "0.0.0.0", "--port", String(FRONTEND_PORT)], {
    cwd: frontendDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipe(frontend, "frontend");

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Stopping StudyLens dev servers...`);
    if (backend && !backend.killed) backend.kill("SIGTERM");
    if (frontend && !frontend.killed) frontend.kill("SIGTERM");
    setTimeout(() => process.exit(0), 500);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  backend.on("exit", (code) => {
    console.log(`[dev] Flask backend exited (code ${code}). Shutting down frontend too.`);
    if (frontend && !frontend.killed) frontend.kill("SIGTERM");
    process.exit(code || 0);
  });

  frontend.on("exit", (code) => {
    console.log(`[dev] Vite exited (code ${code}).`);
    if (backend && !backend.killed) backend.kill("SIGTERM");
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error("[dev] Unexpected error:", err);
  process.exit(1);
});