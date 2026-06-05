import { isTfnswKeyConfigured } from "../src/config/index.js";
import { config } from "../src/config/index.js";
import { fetchTransportNswVehiclePositions } from "./gtfsRealtimeVehicles.js";

const CACHE_TTL_MS = 18_000;
const FAILURE_CACHE_MS = 8_000;

let cache = null;
let failureCache = null;
let inFlight = null;

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function normalizeMode(mode) {
  const m = String(mode || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (m === "lightrail") return "light_rail";
  return m;
}

export function routeMatches(vehicleRoute, filterRoute) {
  const a = String(vehicleRoute || "")
    .toUpperCase()
    .replace(/\s/g, "");
  const b = String(filterRoute || "")
    .toUpperCase()
    .replace(/\s/g, "");
  if (!a || !b || a === "—") return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function filterVehicles(list, { mode, route, lat, lng, radiusM, limit }) {
  let out = list;

  const modeNorm = normalizeMode(mode);
  if (modeNorm && modeNorm !== "all") {
    out = out.filter((v) => v.mode === modeNorm);
  }

  if (route) {
    out = out.filter((v) => routeMatches(v.routeNumber, route));
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const r = Math.min(Math.max(radiusM || 12_000, 500), 50_000);
    out = out
      .map((v) => ({
        ...v,
        distanceM: Math.round(haversineM(lat, lng, v.lat, v.lon)),
      }))
      .filter((v) => v.distanceM <= r)
      .sort((a, b) => a.distanceM - b.distanceM);
  }

  const cap = Math.min(limit || 120, 200);
  return out.slice(0, cap);
}

async function pullLiveVehicles() {
  const apiKey = config.tfnsw.apiKey;
  const vehicles = await fetchTransportNswVehiclePositions(apiKey);
  return {
    vehicles,
    asOf: new Date().toISOString(),
    source: "transportnsw-gtfs-rt",
    dataSource: "https://transportnsw.info",
    tfnswLive: true,
    count: vehicles.length,
  };
}

/**
 * Live train / metro / bus / light rail / ferry positions near a point or on a route.
 */
export async function getLiveVehicles({
  mode,
  route,
  lat,
  lng,
  radiusM,
  limit,
  forceRefresh = false,
} = {}) {
  if (!isTfnswKeyConfigured()) {
    return {
      vehicles: [],
      asOf: new Date().toISOString(),
      source: "unconfigured",
      dataSource: "https://transportnsw.info",
      tfnswLive: false,
      count: 0,
      message: "Set TFNSW_API_KEY for live vehicle tracking.",
    };
  }

  const now = Date.now();
  if (!forceRefresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    const filtered = filterVehicles(cache.payload.vehicles, {
      mode,
      route,
      lat,
      lng,
      radiusM,
      limit,
    });
    return {
      ...cache.payload,
      vehicles: filtered,
      count: filtered.length,
      cached: true,
    };
  }

  if (!forceRefresh && failureCache && now - failureCache.fetchedAt < FAILURE_CACHE_MS) {
    const filtered = filterVehicles(failureCache.payload.vehicles, {
      mode,
      route,
      lat,
      lng,
      radiusM,
      limit,
    });
    return { ...failureCache.payload, vehicles: filtered, count: filtered.length };
  }

  if (inFlight) {
    const base = await inFlight;
    const filtered = filterVehicles(base.vehicles, { mode, route, lat, lng, radiusM, limit });
    return { ...base, vehicles: filtered, count: filtered.length };
  }

  inFlight = (async () => {
    try {
      const payload = await pullLiveVehicles();
      cache = { fetchedAt: Date.now(), payload };
      failureCache = null;
      return payload;
    } catch (err) {
      console.warn("Live vehicles failed:", err.message);
      const payload = {
        vehicles: [],
        asOf: new Date().toISOString(),
        source: "transportnsw-unavailable",
        dataSource: "https://transportnsw.info",
        tfnswLive: false,
        count: 0,
      };
      failureCache = { fetchedAt: Date.now(), payload };
      return payload;
    } finally {
      inFlight = null;
    }
  })();

  const base = await inFlight;
  const filtered = filterVehicles(base.vehicles, { mode, route, lat, lng, radiusM, limit });
  return { ...base, vehicles: filtered, count: filtered.length };
}

export function clearVehiclesCache() {
  cache = null;
  failureCache = null;
  inFlight = null;
}
