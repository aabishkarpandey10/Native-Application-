/**
 * Per-station TfNSW throttle + in-flight deduplication to avoid HTTP 429.
 */
const lastFetchAt = new Map();
const inFlight = new Map();

const DEFAULT_MIN_INTERVAL_MS = Number(process.env.TFNSW_MIN_INTERVAL_MS) || 8000;

export function shouldThrottleTfnsw(stationId, minIntervalMs = DEFAULT_MIN_INTERVAL_MS) {
  const last = lastFetchAt.get(stationId) || 0;
  return Date.now() - last < minIntervalMs;
}

export function markTfnswFetched(stationId) {
  lastFetchAt.set(stationId, Date.now());
}

export function getInFlightTfnsw(stationId) {
  return inFlight.get(stationId) || null;
}

export function setInFlightTfnsw(stationId, promise) {
  inFlight.set(stationId, promise);
  promise.finally(() => {
    if (inFlight.get(stationId) === promise) inFlight.delete(stationId);
  });
  return promise;
}
