/**
 * Syncs variables from .env.example into .env (Expo + backend) and backend/.env.
 * Preserves existing non-placeholder values already in .env so your TFNSW key is not wiped.
 * Run after editing .env.example: npm run setup:env
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = join(root, ".env.example");

if (!existsSync(examplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function isPlaceholderValue(value) {
  if (!value) return true;
  return /placeholder|your_tfnsw|example|changeme|^$/i.test(value);
}

const raw = readFileSync(examplePath, "utf8");
const exampleVars = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  exampleVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}

const existingRoot = parseEnvFile(join(root, ".env"));
const existingBackend = parseEnvFile(join(root, "backend", ".env"));

function mergedValue(key) {
  const fromRoot = existingRoot[key];
  const fromBackend = existingBackend[key];
  const fromExample = exampleVars[key] ?? "";

  if (fromRoot && !isPlaceholderValue(fromRoot)) return fromRoot;
  if (fromBackend && !isPlaceholderValue(fromBackend)) return fromBackend;
  return fromExample;
}

const expoKeys = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_API_SAME_ORIGIN",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_ENABLE_ADMIN",
  "EXPO_PUBLIC_ENABLE_ASSISTANT",
  "EXPO_PUBLIC_API_DEBUG",
  "WEB_PORT",
];
const backendKeys = [
  "TFNSW_API_KEY",
  "PORT",
  "HOST",
  "NODE_ENV",
  "ENABLE_ADMIN",
  "ALLOW_MOCK_DATA",
  "PUBLIC_URL",
  "CORS_ORIGIN",
  "DOCKER_JWT_SECRET",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "REFRESH_EXPIRES_IN",
  "REDIS_ENABLED",
  "REDIS_URL",
  "RATE_LIMIT_MAX",
  "RATE_LIMIT_WINDOW_MS",
  "AUTH_RATE_LIMIT_MAX",
  "TFNSW_POLL_MS",
  "CACHE_TTL_SECONDS",
  "STALE_CACHE_TTL_SECONDS",
  "WS_HEARTBEAT_MS",
  "ADMIN_PASSWORD",
  "ADMIN_TOKEN",
];

const rootEnv = [
  "# Generated from .env.example — edit .env.example then run: npm run setup:env",
  "# Existing TFNSW_API_KEY and other secrets in .env are preserved.",
  "",
  "# Expo",
  ...expoKeys.map((k) => `${k}=${mergedValue(k)}`),
  "",
  "# Backend (loaded by backend/server.js)",
  ...backendKeys.map((k) => `${k}=${mergedValue(k)}`),
  "",
].join("\n");

const backendEnv = [
  "# Generated from .env.example — synced with root .env",
  ...backendKeys.map((k) => `${k}=${mergedValue(k)}`),
  "",
].join("\n");

writeFileSync(join(root, ".env"), rootEnv, "utf8");
writeFileSync(join(root, "backend", ".env"), backendEnv, "utf8");

console.log("Wrote .env and backend/.env (preserved existing secrets where set)");
