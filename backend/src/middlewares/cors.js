import cors from "cors";
import { config } from "../config/index.js";

/**
 * CORS for web clients. Native Android/iOS apps are not subject to CORS but send no Origin header.
 * Set CORS_ORIGIN=https://your-web-app.com,https://another.com in production (comma-separated).
 * Use CORS_ORIGIN=* to allow any browser origin (mobile apps always allowed).
 */
export function createCorsMiddleware() {
  const origins = config.cors.origins;

  if (config.nodeEnv !== "production" || origins.length === 0) {
    return cors({ credentials: true });
  }

  return cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origins.includes("*") || origins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
  });
}
