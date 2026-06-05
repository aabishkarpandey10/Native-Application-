import { config, isTfnswKeyConfigured } from "../config/index.js";

const memoryCache = new Map();
let redisClient = null;

export async function initCache() {
  if (!config.redis.enabled) return;
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    await redisClient.connect();
    console.log("[Cache] Redis connected");
  } catch (err) {
    console.warn("[Cache] Redis unavailable, using in-memory:", err.message);
    redisClient = null;
  }
}

export async function cacheGet(key) {
  if (redisClient) {
    try {
      const raw = await redisClient.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      /* fallback */
    }
  }
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet(key, value, ttlSeconds = config.tfnsw.cacheTtlSeconds) {
  const payload = JSON.stringify(value);
  if (redisClient) {
    try {
      await redisClient.setex(key, ttlSeconds, payload);
      return;
    } catch {
      /* fallback */
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheGetStale(key) {
  const fresh = await cacheGet(key);
  if (fresh) return { data: fresh, stale: false };
  const staleKey = `stale:${key}`;
  const stale = await cacheGet(staleKey);
  if (stale) return { data: stale, stale: true };
  return { data: null, stale: false };
}

export async function cacheSetWithStale(key, value, ttlSeconds) {
  const ttl = ttlSeconds ?? config.tfnsw.cacheTtlSeconds;
  await cacheSet(key, value, ttl);
  await cacheSet(`stale:${key}`, value, config.tfnsw.staleTtlSeconds);
}

export function cacheKeyForDepartures(stationId) {
  return `departures:${stationId}`;
}

/** Bust departure cache after admin edits or forced refresh. */
export async function clearDeparturesCache(stationId) {
  const keys = stationId
    ? [
        cacheKeyForDepartures(stationId),
        `${cacheKeyForDepartures(stationId)}:fullday`,
        `stale:${cacheKeyForDepartures(stationId)}`,
        `stale:${cacheKeyForDepartures(stationId)}:fullday`,
      ]
    : [...memoryCache.keys()].filter(
        (k) => k.startsWith("departures:") || k.startsWith("stale:departures:")
      );

  for (const key of keys) {
    memoryCache.delete(key);
    if (redisClient) {
      try {
        await redisClient.del(key);
      } catch {
        /* ignore */
      }
    }
  }
}

export function getDataSourceMeta() {
  return {
    tfnswConfigured: isTfnswKeyConfigured(),
    cacheBackend: redisClient ? "redis" : "memory",
  };
}
