import { config } from "../config/index.js";

const buckets = new Map();

function pruneBucket(bucket, windowMs) {
  const now = Date.now();
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
}

export function createRateLimiter({ windowMs = config.rateLimit.windowMs, max = config.rateLimit.max } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    if (!buckets.has(key)) buckets.set(key, { timestamps: [] });
    const bucket = buckets.get(key);
    pruneBucket(bucket, windowMs);
    if (bucket.timestamps.length >= max) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Limit: ${max} per ${windowMs / 1000}s`,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      });
    }
    bucket.timestamps.push(Date.now());
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(max - bucket.timestamps.length));
    next();
  };
}

export const apiRateLimit = createRateLimiter();
export const authRateLimit = createRateLimiter({
  max: config.rateLimit.authMax,
  windowMs: 60_000,
});
