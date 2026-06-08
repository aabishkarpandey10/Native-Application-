import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../../..");

// Platform env vars (Render/Railway PORT, JWT_SECRET, etc.) must win over local .env files.
const dotenvOpts = { override: false };
dotenv.config({ path: join(rootDir, ".env"), ...dotenvOpts });
dotenv.config({ path: join(rootDir, "backend/.env"), ...dotenvOpts });

/** Admin panel: on by default in dev; in production set ENABLE_ADMIN=true. */
export function isAdminEnabled() {
  const flag = String(process.env.ENABLE_ADMIN ?? "")
    .trim()
    .toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return (process.env.NODE_ENV || "development") !== "production";
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  publicUrl: process.env.PUBLIC_URL?.trim() || "",
  cors: {
    origins: (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  /** Demo timetables — off by default; set ALLOW_MOCK_DATA=true for local offline dev only. */
  allowMockData: process.env.ALLOW_MOCK_DATA === "true",
  logRequests: process.env.API_REQUEST_LOG === "true",
  tfnsw: {
    apiKey: process.env.TFNSW_API_KEY?.trim() || "",
    baseUrl: process.env.TFNSW_API_BASE || "https://api.transport.nsw.gov.au/v1/tp",
    pollIntervalMs: Number(process.env.TFNSW_POLL_MS) || 30_000,
    cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 25,
    staleTtlSeconds: Number(process.env.STALE_CACHE_TTL_SECONDS) || 300,
  },
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    enabled: process.env.REDIS_ENABLED === "true",
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "tripview-dev-secret-change-in-production",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "7d",
    bcryptRounds: 10,
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 120,
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  },
  websocket: {
    heartbeatMs: Number(process.env.WS_HEARTBEAT_MS) || 25_000,
    path: "/ws/v1",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY?.trim() || "",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
  admin: {
    password: process.env.ADMIN_PASSWORD?.trim() || "admin123",
    token: process.env.ADMIN_TOKEN?.trim() || "sydney-transit-admin-dev",
    enabled: isAdminEnabled(),
  },
};

export function isTfnswKeyConfigured() {
  const key = config.tfnsw.apiKey;
  if (!key || key.length <= 5) return false;
  if (/placeholder|your_tfnsw|example|changeme/i.test(key)) return false;
  return true;
}

const INSECURE_JWT_SECRETS = new Set([
  "tripview-dev-secret-change-in-production",
  "change-me-in-production-min-32-chars",
]);

/** Run at startup — throws in production when critical secrets are missing. */
export function validateProductionConfig() {
  const warnings = [];
  const errors = [];

  if (config.nodeEnv === "production") {
    if (INSECURE_JWT_SECRETS.has(config.auth.jwtSecret)) {
      errors.push("Set JWT_SECRET to a unique random string (min 32 chars) in production");
    }
    if (!isTfnswKeyConfigured()) {
      warnings.push("TFNSW_API_KEY is missing or placeholder — live departures will fail");
    }
    if (config.redis.enabled && /localhost|127\.0\.0\.1/i.test(config.redis.url)) {
      warnings.push("REDIS_URL points to localhost — use a hosted Redis URL in production");
    }
  }

  return { warnings, errors };
}
