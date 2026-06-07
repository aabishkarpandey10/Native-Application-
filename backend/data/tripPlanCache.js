const TTL_MS = 120_000;
const FULL_DAY_TTL_MS = 300_000;
const cache = new Map();

export function tripPlanCacheKey(originId, destId, departDate, includePast, fullDay = false) {
  const bucket = fullDay ? "fullday" : Math.floor(departDate.getTime() / 300_000);
  return `${originId}|${destId}|${bucket}|${includePast ? 1 : 0}|${fullDay ? 1 : 0}`;
}

export function getTripPlanCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  const ttl = hit.ttlMs ?? TTL_MS;
  if (Date.now() - hit.fetchedAt > ttl) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

export function setTripPlanCache(key, payload, { ttlMs = TTL_MS } = {}) {
  cache.set(key, { fetchedAt: Date.now(), payload, ttlMs });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}
