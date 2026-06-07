import { GREATER_SYDNEY_TRAIN_STATIONS } from "./trainNetworkData.js";
import { SYDNEY_FERRY_WHARFS, FERRY_STATION_BY_ID } from "./ferryNetworkData.js";
import { SYDNEY_BUS_STOPS, BUS_STATION_BY_ID } from "./busNetworkData.js";
import {
  SYDNEY_LIGHT_RAIL_STOPS,
  LIGHT_RAIL_STATION_BY_ID,
} from "./lightRailNetworkData.js";
import {
  SYDNEY_METRO_STATIONS,
  METRO_STATION_BY_ID,
} from "./metroNetworkData.js";
import { getStations } from "./adminStore.js";

export const POPULAR_METRO_STATION_IDS = [
  "TALLAWONG_M",
  "CHATSWOOD_M",
  "BARANGAROO_M",
  "GADIGAL_M",
  "CENTRAL_M",
  "SYDENHAM_M",
  "BANKSTOWN_M",
  "CAMPSIE_M",
];

export const POPULAR_LIGHT_RAIL_STOP_IDS = [
  "CENTRAL_LR",
  "CIRCULARQUAY_LR",
  "TOWNHALL_LR",
  "HAYMARKET_LR",
  "RANDWICK_LR",
  "KINGSFORD_LR",
];

export const POPULAR_BUS_STOP_IDS = [
  "CIRCULARQUAY_B",
  "CENTRALSTATION_B",
  "BONDIJUNCTIONSTATION_B",
  "BONDIBEACH_B",
  "PARRAMATTASTATION_B",
  "CHATSWOODSTATION_B",
];

let coreStationsCache = null;
let coreByIdCache = null;

export function invalidateStationCaches() {
  coreStationsCache = null;
  coreByIdCache = null;
}

/** Admin-merged stations visible in the app (respects disabled + custom stations). */
export function getPublicStations() {
  return getStations().filter((s) => !s.disabled);
}

function overlayStation(base) {
  if (!base?.id) return base;
  const merged = getStations().find((s) => s.id === base.id);
  if (!merged) return base;
  if (merged.disabled) return null;
  return { ...base, ...merged, disabled: false };
}

function buildCoreStations() {
  const trains = GREATER_SYDNEY_TRAIN_STATIONS.map((s) => ({ ...s, mode: "train", disabled: false }));
  const lightRail = SYDNEY_LIGHT_RAIL_STOPS.map((s) => ({ ...s, disabled: false }));
  const metro = SYDNEY_METRO_STATIONS.map((s) => ({ ...s, disabled: false }));
  return [...trains, ...SYDNEY_FERRY_WHARFS, ...metro, ...lightRail];
}

/** Train, metro, light rail, ferry — no bus (bus is loaded on demand). */
export function getCoreStations() {
  if (!coreStationsCache) coreStationsCache = buildCoreStations();
  return coreStationsCache;
}

function getCoreById() {
  if (!coreByIdCache) {
    coreByIdCache = Object.fromEntries(getCoreStations().map((s) => [s.id, s]));
  }
  return coreByIdCache;
}

export function getStationById(id) {
  if (!id) return null;
  const fromAdmin = getStations().find((s) => s.id === id);
  if (fromAdmin) return fromAdmin.disabled ? null : fromAdmin;
  return (
    overlayStation(BUS_STATION_BY_ID[id]) ??
    overlayStation(LIGHT_RAIL_STATION_BY_ID[id]) ??
    overlayStation(METRO_STATION_BY_ID[id]) ??
    overlayStation(getCoreById()[id]) ??
    null
  );
}

export function getPopularLightRailStops() {
  return POPULAR_LIGHT_RAIL_STOP_IDS.map((id) => LIGHT_RAIL_STATION_BY_ID[id]).filter(Boolean);
}

export function getPopularBusStops() {
  return POPULAR_BUS_STOP_IDS.map((id) => BUS_STATION_BY_ID[id]).filter(Boolean);
}

export function getPopularMetroStations() {
  return POPULAR_METRO_STATION_IDS.map((id) => METRO_STATION_BY_ID[id]).filter(Boolean);
}

function matchesQuery(stop, q) {
  const name = stop.name.toLowerCase();
  const code = (stop.code || "").toLowerCase();
  return name.includes(q) || code.includes(q);
}

/** Search bus stops by name (min 2 chars). Capped for fast responses. */
export function searchBusStops(query, { limit = 50 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const out = [];
  for (const stop of SYDNEY_BUS_STOPS) {
    if (!matchesQuery(stop, q)) continue;
    out.push(stop);
    if (out.length >= limit) break;
  }
  return out;
}

/** Nearest bus stops to a point (top-K without sorting the full network). */
export function nearbyBusStops(lat, lng, { limit = 80 } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const cap = Math.min(limit, 80);
  const best = [];

  for (const s of SYDNEY_BUS_STOPS) {
    const dist = (s.lat - lat) ** 2 + (s.lon - lng) ** 2;
    if (best.length < cap) {
      best.push({ s, dist });
      if (best.length === cap) best.sort((a, b) => a.dist - b.dist);
      continue;
    }
    if (dist >= best[best.length - 1].dist) continue;
    best[best.length - 1] = { s, dist };
    best.sort((a, b) => a.dist - b.dist);
  }

  return best.map(({ s }) => s);
}

export function resolveStationsForApi({
  mode,
  query,
  popular,
  lat,
  lng,
  limit = 50,
  ids,
}) {
  const modeNorm = String(mode || "").toLowerCase();

  if (ids) {
    const idList = String(ids)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return idList.map((id) => getStationById(id)).filter((s) => s && !s.disabled);
  }

  if (modeNorm === "lightrail" || modeNorm === "light_rail") {
    let list = SYDNEY_LIGHT_RAIL_STOPS.map((s) => overlayStation(s)).filter(Boolean);
    if (popular === "1" || popular === "true") {
      return getPopularLightRailStops().map((s) => overlayStation(s)).filter(Boolean);
    }
    if (query && query.length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q))
      );
      return list.slice(0, limit);
    }
    return list;
  }

  if (modeNorm === "metro") {
    let list = SYDNEY_METRO_STATIONS.map((s) => overlayStation(s)).filter(Boolean);
    if (popular === "1" || popular === "true") {
      return getPopularMetroStations().map((s) => overlayStation(s)).filter(Boolean);
    }
    if (query && query.length >= 2) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q))
      );
      return list.slice(0, limit);
    }
    return list;
  }

  if (modeNorm === "bus") {
    if (popular === "1" || popular === "true") return getPopularBusStops();
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return nearbyBusStops(lat, lng, { limit: Math.min(limit, 80) });
    }
    if (query && query.length >= 2) {
      return searchBusStops(query, { limit });
    }
    return getPopularBusStops();
  }

  let list = getPublicStations();
  if (modeNorm) {
    const m = modeNorm === "light_rail" ? "lightrail" : modeNorm;
    list = list.filter((s) => s.mode === m);
  }
  if (query) {
    const q = query.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q))
    );
    return list.slice(0, limit);
  }
  return list;
}
