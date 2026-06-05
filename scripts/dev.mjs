/**
 * Starts backend + Expo web together (one command for local dev).
 */
import { spawn, execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let port = 3000;

function loadPort() {
  const envPath = join(root, "backend", ".env");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^PORT=(\d+)/m);
    if (m) port = Number(m[1]);
  }
}

async function waitForBackend(maxMs = 25000) {
  const url = `http://127.0.0.1:${port}/api/status`;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        console.log(`\n✓ Backend ready (${url}) — data: ${data.dataSource || "ok"}\n`);
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn(`\n⚠ Backend not responding on port ${port} yet — Expo will still start.\n`);
}

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(`[${name}] exited with code ${code}`);
  });
  return child;
}

console.log("Sydney Transit — full stack dev\n");

execSync("node scripts/setup-env.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/install-backend.mjs", { cwd: root, stdio: "inherit" });

loadPort();

const webPort = process.env.WEB_PORT || "8085";

const backend = run("backend", "node", ["backend/server.js"]);
await waitForBackend();

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  App (web):  http://localhost:${webPort}
  API:        http://127.0.0.1:${port}/api/status
  Admin:      http://127.0.0.1:${port}/admin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

const expo = run("expo", "npx", ["expo", "start", "--web", "--port", webPort]);

function shutdown() {
  console.log("\nStopping dev servers…");
  backend.kill("SIGTERM");
  expo.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
