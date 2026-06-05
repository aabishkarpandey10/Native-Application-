/**
 * Verifies backend health and TypeScript compile. Used by npm run verify / build.
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

console.log("→ TypeScript check…");
execSync("npx tsc --noEmit", { cwd: root, stdio: "inherit" });

console.log(`→ Backend health http://127.0.0.1:${port}/api/status …`);
const res = await fetch(`http://127.0.0.1:${port}/api/status`);
if (!res.ok) {
  console.error(`Backend returned HTTP ${res.status}. Start it: npm run backend`);
  process.exit(1);
}
const body = await res.json();
console.log("  API OK:", JSON.stringify(body));
console.log("Stack check passed.");
