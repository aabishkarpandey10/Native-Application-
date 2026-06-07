/**
 * Build signed release APK + AAB and copy artifacts to /build-output.
 * Loads EXPO_PUBLIC_* from .env via Expo's bundler during Gradle embed step.
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "android");
const outDir = join(root, "build-output");
const isWin = process.platform === "win32";
const gradlew = join(androidDir, isWin ? "gradlew.bat" : "gradlew");

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWin });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(gradlew)) {
  console.error("Missing android/ — run: npx expo prebuild --platform android");
  process.exit(1);
}

console.log("→ Syncing native Android project from app.config.js …");
run("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], root);

console.log("→ Building release APK and AAB …");
run(gradlew, ["assembleRelease", "bundleRelease", "--no-daemon", "--warning-mode", "all"], androidDir);

mkdirSync(outDir, { recursive: true });

const artifacts = [
  {
    src: join(androidDir, "app/build/outputs/apk/release/app-release.apk"),
    dest: join(outDir, "sydney-transit-release.apk"),
  },
  {
    src: join(androidDir, "app/build/outputs/bundle/release/app-release.aab"),
    dest: join(outDir, "sydney-transit-release.aab"),
  },
];

for (const { src, dest } of artifacts) {
  if (!existsSync(src)) {
    console.error(`Build artifact missing: ${src}`);
    process.exit(1);
  }
  cpSync(src, dest);
  console.log(`✓ ${dest}`);
}

function loadEnvApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) return process.env.EXPO_PUBLIC_API_URL.trim();
  try {
    const envText = readFileSync(join(root, ".env"), "utf8");
    const match = envText.match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

const apiUrl = loadEnvApiUrl();
console.log(`\nBundled EXPO_PUBLIC_API_URL: ${apiUrl ?? "(NOT SET — APK will use 127.0.0.1:3000 and fail on device)"}`);

if (!apiUrl) {
  console.error("\nERROR: Set EXPO_PUBLIC_API_URL in .env before building release APK.");
  console.error("Example (same Wi‑Fi testing): EXPO_PUBLIC_API_URL=http://192.168.x.x:3000");
  console.error("Production: EXPO_PUBLIC_API_URL=https://your-api.example.com\n");
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/i.test(apiUrl) && !process.argv.includes("--allow-localhost")) {
  console.error("\nERROR: EXPO_PUBLIC_API_URL is localhost — release APK cannot reach your PC.");
  console.error("Use your PC's LAN IP (ipconfig) or a public HTTPS URL.");
  console.error("Override only for emulator testing: npm run build:android:release -- --allow-localhost\n");
  process.exit(1);
}

console.log("\n→ Verifying bundled API URL in APK …");
run("node", ["scripts/verify-release-api.mjs"], root);
