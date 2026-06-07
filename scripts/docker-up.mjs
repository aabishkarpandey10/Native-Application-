/**
 * Build and start Sydney Transit via Docker Compose.
 * Requires Docker Desktop: https://www.docker.com/products/docker-desktop/
 */
import { spawnSync, execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { setTimeout as delay } from "timers/promises";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const DOCKER_DESKTOP_PATHS = [
  process.env.ProgramFiles && join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe"),
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
].filter(Boolean);

function findDocker() {
  const candidates = [
    "docker",
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    process.env.ProgramFiles && join(process.env.ProgramFiles, "Docker", "Docker", "resources", "bin", "docker.exe"),
  ].filter(Boolean);

  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ["--version"], { encoding: "utf8", shell: true });
      if (r.status === 0) return cmd;
    } catch {
      // try next
    }
  }
  return null;
}

function runDocker(docker, args, timeoutMs = 15_000) {
  try {
    return spawnSync(docker, args, { encoding: "utf8", shell: true, timeout: timeoutMs });
  } catch (err) {
    if (err.code === "ETIMEDOUT") {
      return { status: 1, stdout: "", stderr: "docker command timed out" };
    }
    throw err;
  }
}

function isDaemonRunning(docker) {
  const r = runDocker(docker, ["info"]);
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (/500 Internal Server Error.*dockerDesktopLinuxEngine/i.test(out)) return "engine-500";
  if (r.status === 0 && /Server Version:/i.test(out) && !/ERROR:/i.test(out)) return "ok";
  if (/dockerDesktopLinuxEngine|Cannot connect to the Docker daemon|The system cannot find the file specified/i.test(out)) {
    return "engine-down";
  }
  return "unknown";
}

function findDockerDesktopExe() {
  for (const p of DOCKER_DESKTOP_PATHS) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function startDockerDesktop() {
  const exe = findDockerDesktopExe();
  if (!exe) return false;

  console.log("→ Starting Docker Desktop …");
  const r = spawnSync("cmd", ["/c", "start", "", exe], {
    shell: true,
    stdio: "ignore",
  });
  return r.status === 0;
}

async function ensureDockerDaemon(docker, { startIfStopped = true, timeoutMs = 180_000 } = {}) {
  let state = isDaemonRunning(docker);
  if (state === "ok") return true;

  if (state === "engine-500" && isWin) {
    console.log("Docker engine returned HTTP 500 — running repair …\n");
    execSync("node scripts/docker-repair.mjs", { cwd: root, stdio: "inherit" });
    return isDaemonRunning(docker) === "ok";
  }

  if (startIfStopped && isWin && state === "engine-down") {
    startDockerDesktop();
  }

  const deadline = Date.now() + timeoutMs;
  let dots = 0;
  while (Date.now() < deadline) {
    state = isDaemonRunning(docker);
    if (state === "ok") {
      console.log("\n✓ Docker engine is running\n");
      return true;
    }
    if (state === "engine-500") break;
    process.stdout.write(dots === 0 ? "  Waiting for Docker engine" : ".");
    dots = (dots + 1) % 40;
    if (dots === 0) process.stdout.write("\n");
    await delay(3000);
  }

  return false;
}

function printDockerHelp(command) {
  console.error(`
Docker engine is not running or returned HTTP 500.

Quick fix (Windows):
  npm run docker:repair
  npm run docker:check

Then:
  npm run ${command}

Manual steps:
1. Quit Docker Desktop → wsl --shutdown → start Docker Desktop again
2. Docker Desktop → Troubleshoot → Restart Docker Desktop
3. Settings → General → "Use the WSL 2 based engine"

Install: https://www.docker.com/products/docker-desktop/
`);
}

const docker = findDocker();
if (!docker) {
  console.error(`
Docker is not installed or not on your PATH.

1. Install Docker Desktop for Windows:
   https://www.docker.com/products/docker-desktop/

2. Start Docker Desktop and wait until it shows "Running".

3. Run again:
   npm run docker:up
`);
  process.exit(1);
}

console.log(`Using ${docker}`);

const args = process.argv.slice(2);
const npmCommand = args.includes("--api-only") ? "docker:api" : "docker:up";

if (!(await ensureDockerDaemon(docker))) {
  printDockerHelp(npmCommand);
  process.exit(1);
}

execSync("node scripts/setup-env.mjs", { cwd: root, stdio: "inherit" });

const composeFiles = args.includes("--api-only")
  ? ["-f", "docker-compose.api.yml"]
  : ["-f", "docker-compose.yml"];
const profile = ["compose", ...composeFiles, "up", "--build", "-d"];

const result = spawnSync(docker, profile, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) {
  if (isDaemonRunning(docker) !== "ok") {
    printDockerHelp(npmCommand);
  }
  process.exit(result.status ?? 1);
}

if (args.includes("--api-only")) {
  console.log(`
✓ API container running
  http://localhost:3000/api/health
  http://localhost:3000/admin

Run Expo locally: npx expo start --web --port 8085
`);
} else {
  console.log(`
✓ Stack running
  App:   http://localhost:8085
  API:   http://localhost:3000
  Admin: http://localhost:3000/admin

Logs: npm run docker:logs
Stop: npm run docker:down
`);
}
