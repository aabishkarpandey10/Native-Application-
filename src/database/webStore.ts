/** In-memory store when SQLite is unavailable (e.g. web) */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_ALERTS,
  generateDeparturesForStation,
  SYDNEY_STATIONS,
} from "./seedData";
import type { Departure, ServiceAlert } from "../services/tfnsw";
import { parseTfnswTime, toIsoString } from "../utils/tfnswTime";
import { trainDeparturesLookStale, departuresLookTimeStale } from "../utils/departureCache";
import { getRouteHexColor } from "../utils/transitColors";

const KEY = "transit_web_store_v3";

interface WebStoreData {
  seeded: boolean;
  departures: Record<string, ReturnType<typeof generateDeparturesForStation>>;
  favorites: Array<{ station_id: string; station_name: string; transit_mode: string }>;
  trips: Array<Record<string, unknown>>;
  recent: string[];
  cachedAlerts?: ServiceAlert[];
  alertsCachedAt?: string;
}

let memory: WebStoreData | null = null;

async function load(): Promise<WebStoreData> {
  if (memory) return memory;
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) {
    memory = JSON.parse(raw);
    return memory!;
  }
  memory = {
    seeded: true,
    departures: {},
    favorites: [
      { station_id: "CENTRAL_T", station_name: "Central Station", transit_mode: "train" },
      { station_id: "TOWNHALL_T", station_name: "Town Hall Station", transit_mode: "train" },
      { station_id: "CIRCULARQUAY_T", station_name: "Circular Quay Station", transit_mode: "train" },
      { station_id: "CHATSWOOD_T", station_name: "Chatswood Station", transit_mode: "train" },
    ],
    trips: [
      {
        id: "trip_central_townhall",
        origin_id: "CENTRAL_T",
        origin_name: "Central Station",
        destination_id: "TOWNHALL_T",
        destination_name: "Town Hall Station",
        transit_mode: "train",
        route_number: "T1",
        description: "Weekday commute",
        frequency: "Every 10 min",
      },
      {
        id: "trip_townhall_bondi",
        origin_id: "TOWNHALL_T",
        origin_name: "Town Hall Station",
        destination_id: "BONDI_T",
        destination_name: "Bondi Junction Station",
        transit_mode: "train",
        route_number: "T4",
        description: "Afternoon trip",
        frequency: "Every 15 min",
      },
      {
        id: "trip_cq_manly",
        origin_id: "CQ_W2",
        origin_name: "Circular Quay Wharf 2",
        destination_id: "MANLY_W",
        destination_name: "Manly Wharf",
        transit_mode: "ferry",
        route_number: "F1",
        description: "Weekend ferry",
        frequency: "Every 20 min",
      },
    ],
    recent: [],
  };
  // Departures are generated on demand per station (faster startup)
  await AsyncStorage.setItem(KEY, JSON.stringify(memory));
  return memory;
}

async function save() {
  if (memory) await AsyncStorage.setItem(KEY, JSON.stringify(memory));
}

export async function initWebStore() {
  await load();
}

function cachedDepsMatchStation(
  deps: ReturnType<typeof generateDeparturesForStation>,
  expectedMode: string | undefined
) {
  if (!expectedMode || deps.length === 0) return true;
  const norm = expectedMode === "lightrail" ? "light_rail" : expectedMode;
  return deps.every((d) => {
    const m = String(d.mode);
    const route = d.route_number || "";
    if (norm === "train") {
      if (m === "metro" || /^M\d/i.test(route)) return false;
      return m === "train" || /^T\d/i.test(route);
    }
    if (norm === "metro") {
      if (m === "train" && /^T\d/i.test(route)) return false;
      return m === "metro" || /^M\d/i.test(route);
    }
    if (m === norm || (norm === "light_rail" && m === "lightrail")) return true;
    if (norm === "ferry" && /^F\d+/i.test(route)) return true;
    return false;
  });
}

export async function webGetDepartures(stationId: string, limit = 10): Promise<Departure[]> {
  const store = await load();
  const station = SYDNEY_STATIONS.find((s) => s.id === stationId);
  const expectedMode = station?.mode;

  let deps = store.departures[stationId];
  if (
    !cachedDepsMatchStation(deps ?? [], expectedMode) ||
    trainDeparturesLookStale(stationId, deps ?? []) ||
    departuresLookTimeStale(deps ?? [])
  ) {
    delete store.departures[stationId];
    deps = generateDeparturesForStation(stationId, 8);
    store.departures[stationId] = deps;
  } else if (!deps) {
    deps = generateDeparturesForStation(stationId, 8);
    store.departures[stationId] = deps;
  }
  await save();
  return deps.slice(0, limit).map((d) => {
    const sched = parseTfnswTime(d.scheduled_time);
    const realStored = (d as { _real_time?: string })._real_time;
    const realTime = realStored
      ? parseTfnswTime(realStored)
      : new Date(sched.getTime() + (d.delay_minutes || 0) * 60000);
    const rawMode = String(d.mode);
    const mode = rawMode === "lightrail" ? "light_rail" : rawMode;
    return {
      destination: d.destination,
      platform: d.platform,
      departureTime: realTime,
      mode: mode as Departure["mode"],
      routeNumber: d.route_number,
      delayMinutes: d.delay_minutes,
      scheduledTime: sched,
      realTime,
      lineColor: d.line_color || getRouteHexColor(mode, d.route_number),
      lineName: d.line_name || d.route_number,
      stops: d.stops.map((s) => ({
        station_name: s.station_name,
        time: parseTfnswTime(s.time),
      })),
    };
  });
}

function seedAlerts(): ServiceAlert[] {
  return DEFAULT_ALERTS.map((a) => ({
    id: a.id,
    mode: (a.mode === "lightrail" ? "light_rail" : a.mode) as ServiceAlert["mode"],
    title: a.title,
    description: a.description,
    severity: a.severity as ServiceAlert["severity"],
    affectedRoutes: a.affected_routes.split(","),
  }));
}

export async function webCacheAlerts(alerts: ServiceAlert[]) {
  const store = await load();
  store.cachedAlerts = alerts.slice(0, 200);
  store.alertsCachedAt = new Date().toISOString();
  await save();
}

export async function webGetAlerts(): Promise<ServiceAlert[]> {
  const store = await load();
  return store.cachedAlerts ?? [];
}

export async function webGetStats() {
  const store = await load();
  const depCount = Object.values(store.departures).reduce((a, b) => a + b.length, 0);
  return { stations: SYDNEY_STATIONS.length, departures: depCount, alerts: DEFAULT_ALERTS.length };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function webGetNearby(lat: number, lng: number, radius = 2000) {
  const nearby = SYDNEY_STATIONS.map((s) => ({
    station_id: s.id,
    station_name: s.name,
    latitude: s.lat,
    longitude: s.lon,
    transit_mode: s.mode === "lightrail" ? "light_rail" : s.mode,
    distance_meters: Math.round(haversine(lat, lng, s.lat, s.lon)),
  }))
    .filter((s) => s.distance_meters <= radius)
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, 15);

  const result = [];
  for (const stop of nearby) {
    const deps = await webGetDepartures(stop.station_id, 1);
    result.push({ ...stop, next_departure: deps[0] || null });
  }
  return result;
}

export async function webGetRecentSearches(): Promise<string[]> {
  const store = await load();
  return store.recent;
}

export async function webAddRecentSearch(query: string) {
  const store = await load();
  store.recent = [query, ...store.recent.filter((q) => q !== query)].slice(0, 8);
  await save();
}

export async function webGetFavorites() {
  const store = await load();
  return store.favorites;
}

export async function webGetTrips() {
  const store = await load();
  return store.trips;
}

export async function webSaveStation(station: {
  station_id: string;
  station_name: string;
  transit_mode: string;
}) {
  const store = await load();
  if (!store.favorites.some((f) => f.station_id === station.station_id)) {
    store.favorites.push(station);
    await save();
  }
}

export async function webRemoveStation(stationId: string) {
  const store = await load();
  store.favorites = store.favorites.filter((f) => f.station_id !== stationId);
  await save();
}

export async function webSaveTrip(trip: Record<string, unknown>) {
  const store = await load();
  const exists = store.trips.some((t) => t.id === trip.id);
  if (!exists) {
    store.trips.push(trip);
    await save();
  }
}

export async function webRemoveTrip(tripId: string) {
  const store = await load();
  store.trips = store.trips.filter((t) => t.id !== tripId);
  await save();
}

export async function webCacheDeparturesFromApi(
  stationId: string,
  items: Array<Record<string, unknown>>
) {
  const store = await load();
  store.departures[stationId] = items.map((item, i) => {
    const sched = parseTfnswTime((item.scheduledTime ?? item.scheduled_time) as string);
    const delay = Number(item.delayMinutes ?? item.delay_minutes ?? 0) || 0;
    const realRaw = item.realTime ?? item.real_time;
    const real = realRaw
      ? parseTfnswTime(realRaw as string)
      : new Date(sched.getTime() + delay * 60000);
    const rawMode = String(item.mode ?? "train");
    const mode =
      rawMode === "light_rail" || rawMode === "lightrail"
        ? "light_rail"
        : (rawMode as "train" | "metro" | "bus" | "ferry" | "light_rail");
    const route_number = String(item.routeNumber ?? item.route_number ?? "—");
    return {
      id: String(item.id ?? `api_${stationId}_${i}`),
      station_id: stationId,
      route_number,
      destination: String(item.destination ?? ""),
      mode,
      platform: String(item.platform ?? "—"),
      scheduled_time: toIsoString(sched),
      delay_minutes: delay,
      line_color:
        String(item.lineColor ?? item.line_color ?? "") ||
        getRouteHexColor(mode, route_number),
      line_name: String(item.lineName ?? item.line_name ?? route_number),
      stops: Array.isArray(item.stops)
        ? (item.stops as Array<{ station_name: string; time: string }>).map((st, idx) => ({
            station_name: st.station_name,
            time: typeof st.time === "string" ? st.time : toIsoString(new Date(st.time as string)),
            sort_order: idx,
          }))
        : [],
      _real_time: toIsoString(real),
    };
  });
  await save();
}

const DEPS_PER_STATION = 6;

export async function webRefreshDepartures() {
  const store = await load();
  for (const s of SYDNEY_STATIONS) {
    store.departures[s.id] = generateDeparturesForStation(s.id, DEPS_PER_STATION);
  }
  await save();
}
