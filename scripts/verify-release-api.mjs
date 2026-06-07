/**
 * Verify release APK/AAB contains the expected API URL and probe backend /api/status.
 */
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import AdmZip from "adm-zip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apkPath = join(root, "build-output", "sydney-transit-release.apk");

function loadEnvApiUrl() {
  try {
    const envText = readFileSync(join(root, ".env"), "utf8");
    const match = envText.match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return process.env.EXPO_PUBLIC_API_URL?.trim() ?? null;
  }
}

function extractApiUrlFromApk(path) {
  const zip = new AdmZip(path);
  const bundleEntry = zip
    .getEntries()
    .find((e) => e.entryName.includes("index.android.bundle") || e.entryName.endsWith(".bundle"));
  if (!bundleEntry) return { found: null, note: "No JS bundle entry in APK" };

  const text = bundleEntry.getData().toString("utf8");
  const httpMatches = [...text.matchAll(/https?:\/\/[a-zA-Z0-9._:/-]+/g)].map((m) => m[0]);
  const candidates = [...new Set(httpMatches)].filter(
    (u) => u.includes(":3000") || u.includes("localhost") || u.includes("192.168.")
  );
  return { found: candidates[0] ?? null, candidates, note: null };
}

async function probeBackend(url) {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/status`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

const expected = loadEnvApiUrl();
console.log("Expected EXPO_PUBLIC_API_URL:", expected ?? "(not set — bundle may use localhost:3000)");

if (!existsSync(apkPath)) {
  console.error("Missing APK:", apkPath);
  process.exit(1);
}

const { found, candidates, note } = extractApiUrlFromApk(apkPath);
console.log("URL(s) found in release bundle:", candidates.length ? candidates : note ?? "(none matched)");

if (expected && found && !found.includes(expected.replace(/^https?:\/\//, "").split(":")[0])) {
  console.warn("WARNING: bundled URL may not match .env — rebuild after changing EXPO_PUBLIC_API_URL");
}

if (expected) {
  const probe = await probeBackend(expected);
  if (probe.ok) {
    console.log("Backend probe OK:", JSON.stringify(probe.body));
  } else {
    console.warn("Backend probe FAILED from this machine:", probe.error ?? probe.status);
    if (/192\.168\.|10\.\d+\.|localhost|127\.0\.0\.1/i.test(expected)) {
      console.warn(
        "This URL is private/local — cloud Android devices and Play testers cannot reach it."
      );
    }
  }
}
