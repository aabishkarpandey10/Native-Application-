/**
 * Windows: restart WSL + Docker Desktop when the engine returns 500 or won't connect.
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { setTimeout as delay } from "timers/promises";
import { fileURLToPath } from "url";

const isWin = process.platform === "win32";

const DOCKER_DESKTOP = [
  process.env.ProgramFiles && join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe"),
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
].filter(Boolean);

function findDockerDesktop() {
  for (const p of DOCKER_DESKTOP) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: true, ...opts });
}

async function waitForDocker(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = run("docker", ["info"], { timeout: 20_000 });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (/Server Version:/i.test(out) && !/500 Internal Server Error/i.test(out)) {
      return true;
    }
    process.stdout.write(".");
    await delay(4000);
  }
  return false;
}

if (!isWin) {
  console.log("docker:repair is optimized for Windows Docker Desktop.");
  console.log("Try: sudo systemctl restart docker   (Linux)");
  console.log("Or restart Docker Desktop manually (macOS).");
  process.exit(0);
}

console.log("→ Stopping Docker Desktop processes …");
run("powershell", [
  "-NoProfile",
  "-Command",
  "Stop-Process -Name 'Docker Desktop','com.docker.backend','com.docker.proxy','com.docker.service' -Force -ErrorAction SilentlyContinue",
]);

await delay(3000);

console.log("→ Shutting down WSL …");
run("wsl", ["--shutdown"]);
await delay(5000);

const desktop = findDockerDesktop();
if (!desktop) {
  console.error("Docker Desktop not found. Install from https://www.docker.com/products/docker-desktop/");
  process.exit(1);
}

console.log("→ Starting Docker Desktop …");
run("cmd", ["/c", "start", "", desktop]);

process.stdout.write("→ Waiting for engine");
const ok = await waitForDocker();
console.log("");

if (ok) {
  console.log("✓ Docker engine recovered. Run: npm run docker:up");
  process.exit(0);
}

console.error(`
Docker still not healthy after repair.

1. Open Docker Desktop → Troubleshoot → Restart / Clean / Purge data
2. Ensure WSL2 is enabled: wsl --install
3. Settings → General → "Use the WSL 2 based engine"
4. Run again: npm run docker:repair
`);
process.exit(1);
