const TTL_MS = 45_000;
const cache = new Map();

export function tripPlanCacheKey(originId, destId, departDate, includePast) {
  const bucket = Math.floor(departDate.getTime() / 300_000);
  return `${originId}|${destId}|${bucket}|${includePast ? 1 : 0}`;
}

export function getTripPlanCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}

export function setTripPlanCache(key, payload) {
  cache.set(key, { fetchedAt: Date.now(), payload });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}
