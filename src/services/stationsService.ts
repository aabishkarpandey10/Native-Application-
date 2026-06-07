import { SYDNEY_STATIONS, type Station } from "../constants/stations";
import { fetchBackendJson } from "./apiClient";

let cachedCoreStations: Station[] | null = null;
let loadCorePromise: Promise<Station[]> | null = null;

export type StationFetchOptions = {
  mode?: string;
  query?: string;
  popular?: boolean;
  lat?: number;
  lng?: number;
  limit?: number;
  ids?: string[];
};

export function getStationsSync(): Station[] {
  if (cachedCoreStations && cachedCoreStations.length > 0) {
    return cachedCoreStations;
  }
  return SYDNEY_STATIONS;
}

export function setStationsCache(stations: Station[] | null) {
  cachedCoreStations = stations?.length ? stations : null;
}

export function clearStationsCache() {
  cachedCoreStations = null;
}

function buildStationsPath(options: StationFetchOptions = {}): string {
  const params = new URLSearchParams();
  if (options.mode) params.set("mode", options.mode);
  if (options.query) params.set("query", options.query);
  if (options.popular) params.set("popular", "1");
  if (options.lat != null && options.lng != null) {
    params.set("lat", String(options.lat));
    params.set("lng", String(options.lng));
  }
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.ids?.length) params.set("ids", options.ids.join(","));
  const qs = params.toString();
  return qs ? `/api/stations?${qs}` : "/api/stations";
}

export async function fetchStations(options: StationFetchOptions = {}): Promise<Station[]> {
  const path = buildStationsPath(options);
  const data = await fetchBackendJson<Station[]>(path, { timeoutMs: options.mode === "bus" ? 20_000 : 15_000 });
  return data ?? [];
}

/** Core network only (no bus) — fast startup payload. */
export async function fetchCoreStationsFromApi(): Promise<Station[]> {
  if (cachedCoreStations?.length) return cachedCoreStations;
  if (loadCorePromise) return loadCorePromise;

  loadCorePromise = (async () => {
    const data = await fetchStations({ limit: 5000 });
    const list = data.length ? data : SYDNEY_STATIONS;
    setStationsCache(list);
    return list;
  })();

  try {
    return await loadCorePromise;
  } finally {
    loadCorePromise = null;
  }
}

/** @deprecated Prefer fetchCoreStationsFromApi or fetchStations({ mode }). */
export async function fetchStationsFromApi(): Promise<Station[]> {
  return fetchCoreStationsFromApi();
}

export async function fetchStationById(id: string): Promise<Station | undefined> {
  const local = getStationsSync().find((s) => s.id === id);
  if (local) return local;
  const rows = await fetchStations({ ids: [id], limit: 1 });
  return rows[0];
}

export async function ensureStationsLoaded(): Promise<Station[]> {
  return fetchCoreStationsFromApi();
}

export function findStationById(
  stationId: string,
  stations: Station[] = getStationsSync()
): Station | undefined {
  return stations.find((s) => s.id === stationId);
}
