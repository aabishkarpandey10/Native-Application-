import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");

if (!existsSync(join(backendDir, "package.json"))) {
  console.error("backend/package.json not found");
  process.exit(1);
}

execSync("npm install", { cwd: backendDir, stdio: "inherit" });
