/**
 * Verify Docker engine is healthy before compose/build.
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const isWin = process.platform === "win32";

const DOCKER_DESKTOP = [
  process.env.ProgramFiles && join(process.env.ProgramFiles, "Docker", "Docker", "Docker Desktop.exe"),
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
].filter(Boolean);

function findDocker() {
  const candidates = [
    "docker",
    join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe"),
  ];
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8", shell: true });
    if (r.status === 0) return cmd;
  }
  return null;
}

function run(docker, args, timeoutMs = 20_000) {
  try {
    return spawnSync(docker, args, { encoding: "utf8", shell: true, timeout: timeoutMs });
  } catch (err) {
    if (err.code === "ETIMEDOUT") {
      return { status: 1, stdout: "", stderr: "timed out" };
    }
    throw err;
  }
}

function diagnose(out) {
  if (/500 Internal Server Error.*dockerDesktopLinuxEngine/i.test(out)) {
    return "engine-500";
  }
  if (/dockerDesktopLinuxEngine|Cannot connect to the Docker daemon|The system cannot find the file specified/i.test(out)) {
    return "engine-down";
  }
  if (/Server Version:/i.test(out) && !/ERROR:/i.test(out)) {
    return "ok";
  }
  return "unknown";
}

function printFix(kind) {
  if (kind === "engine-500") {
    console.error(`
Docker Desktop engine returned HTTP 500 (corrupted/stuck WSL backend).

Fix (Windows):
  npm run docker:repair

Or manually:
  1. Quit Docker Desktop (tray icon → Quit)
  2. wsl --shutdown
  3. Start Docker Desktop again and wait until "Running"
  4. npm run docker:check
`);
    return;
  }

  if (kind === "engine-down") {
    console.error(`
Docker engine is not running.

  1. Start Docker Desktop from the Start menu
  2. Or run: npm run docker:repair
  3. Then: npm run docker:check
`);
    return;
  }

  console.error(`
Docker check failed. Try:
  npm run docker:repair
  npm run docker:check
`);
}

const docker = findDocker();
if (!docker) {
  console.error("Docker CLI not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/");
  process.exit(1);
}

const r = run(docker, ["info"]);
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
const status = diagnose(out);

if (status === "ok") {
  const version = out.match(/Server Version:\s*(.+)/)?.[1]?.trim();
  const os = out.match(/Operating System:\s*(.+)/)?.[1]?.trim();
  console.log("✓ Docker engine is healthy");
  if (version) console.log(`  Server: ${version}`);
  if (os) console.log(`  OS: ${os}`);
  process.exit(0);
}

console.error(out.trim());
printFix(status);
process.exit(1);
