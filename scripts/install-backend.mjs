import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");

if (!existsSync(join(backendDir, "package.json"))) {
  console.error("backend/package.json not found");
  process.exit(1);
}

const hasLockfile = existsSync(join(backendDir, "package-lock.json"));
const isProduction = process.env.NODE_ENV === "production";
const installCmd =
  isProduction && hasLockfile ? "npm ci --omit=dev" : "npm install";

execSync(installCmd, { cwd: backendDir, stdio: "inherit" });
