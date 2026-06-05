/**
 * Stops the process listening on the backend port (default 3000).
 * Usage: npm run backend:stop
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let port = 3000;

const envPath = join(root, "backend", ".env");
if (existsSync(envPath)) {
  const m = readFileSync(envPath, "utf8").match(/^PORT=(\d+)/m);
  if (m) port = Number(m[1]);
}

const isWin = process.platform === "win32";

try {
  if (isWin) {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"`,
      { encoding: "utf8" }
    ).trim();
    if (!out) {
      console.log(`No process listening on port ${port}.`);
      process.exit(0);
    }
    execSync(`taskkill /F /PID ${out}`, { stdio: "inherit" });
    console.log(`Stopped backend (PID ${out}) on port ${port}.`);
  } else {
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "inherit", shell: true });
    console.log(`Stopped process on port ${port}.`);
  }
} catch (e) {
  console.error(`Could not stop port ${port}:`, e.message || e);
  process.exit(1);
}
