import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "../../..");

dotenv.config({ path: join(rootDir, ".env") });
dotenv.config({ path: join(rootDir, "backend/.env"), override: true });

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
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
};

export function isTfnswKeyConfigured() {
  const key = config.tfnsw.apiKey;
  if (!key || key.length <= 5) return false;
  if (/placeholder|your_tfnsw|example|changeme/i.test(key)) return false;
  return true;
}
