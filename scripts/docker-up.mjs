/**
 * Build and start Sydney Transit via Docker Compose.
 * Requires Docker Desktop: https://www.docker.com/products/docker-desktop/
 */
import { spawnSync, execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function findDocker() {
  const candidates = [
    "docker",
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    process.env.ProgramFiles + "\\Docker\\Docker\\resources\\bin\\docker.exe",
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

console.log(`Using ${docker}\n`);
execSync("node scripts/setup-env.mjs", { cwd: root, stdio: "inherit" });

const args = process.argv.slice(2);
const composeFiles = args.includes("--api-only")
  ? ["-f", "docker-compose.api.yml"]
  : ["-f", "docker-compose.yml"];
const profile = ["compose", ...composeFiles, "up", "--build", "-d"];

const result = spawnSync(docker, profile, {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (result.status !== 0) process.exit(result.status ?? 1);

if (args.includes("--api-only")) {
  console.log(`
✓ API container running
  http://localhost:3000/api/status
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
