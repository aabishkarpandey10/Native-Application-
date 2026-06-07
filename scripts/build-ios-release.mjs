#!/usr/bin/env node
/**
 * Cloud iOS release build → downloads .ipa to /build-output.
 * Requires: EAS login, Apple Developer account (first build is interactive for credentials).
 *
 * Usage:
 *   npm run build:ios:release
 *   node scripts/build-ios-release.mjs --profile production-ipa
 */
import { mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "build-output");
const ipaPath = join(outDir, "sydney-transit-release.ipa");
const profile = process.argv.includes("--profile")
  ? process.argv[process.argv.indexOf("--profile") + 1]
  : "production-ipa";

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) return process.env.EXPO_PUBLIC_API_URL.trim();
  try {
    const envText = readFileSync(join(root, ".env"), "utf8");
    const match = envText.match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
    if (match) return match[1].trim();
  } catch {
    /* optional */
  }
  return null;
}

console.log("\n→ Sydney Transit iOS release (.ipa via EAS Cloud)\n");
console.log(`Profile: ${profile}`);
console.log(`Bundled API URL: ${readApiUrl() ?? "(from EAS production env)"}`);
console.log("\nFirst iOS build: run in your terminal to complete Apple credential setup.\n");

mkdirSync(outDir, { recursive: true });

run("npx", [
  "eas-cli",
  "build",
  "--platform",
  "ios",
  "--profile",
  profile,
  "--wait",
]);

run("npx", [
  "eas-cli",
  "build:download",
  "--platform",
  "ios",
  "--latest",
  "--output",
  ipaPath,
]);

console.log(`\n✓ IPA: ${ipaPath}\n`);
