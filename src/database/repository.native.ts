import { getDatabase, refreshDeparturesInDb as refreshNative } from "./db.native";
import { trainDeparturesLookStale, departuresLookTimeStale } from "../utils/departureCache";
import { getRouteHexColor } from "../utils/transitColors";
import { SYDNEY_STATIONS } from "./seedData";
import { getLinesForStation, SYDNEY_TRAIN_LINES } from "../constants/trainNetworks";
import { buildLineStopSequence } from "../utils/trainStopSequence";
import type { Departure, ServiceAlert, TripItinerary } from "../services/tfnsw";
import { parseTfnswTime, toIsoString } from "../utils/tfnswTime";

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

type DepRow = {
  id: string;
  station_id: string;
  route_number: string;
  destination: string;
  mode: string;
  platform: string;
  scheduled_time: string;
  delay_minutes: number;
  line_color: string;
  line_name: string;
};

async function mapDeparture(row: DepRow): Promise<Departure> {
  const database = await getDatabase();
  const stops = await database.getAllAsync<{ station_name: string; stop_time: string }>(
    `SELECT station_name, stop_time FROM departure_stops WHERE departure_id = ? ORDER BY sort_order`,
    [row.id]
  );
  const { parseTfnswTime } = await import("../utils/tfnswTime");
  const schedTime = parseTfnswTime(row.scheduled_time);
  const delay = row.delay_minutes || 0;
  const realTime = new Date(schedTime.getTime() + delay * 60000);
  const mode = row.mode === "lightrail" ? "light_rail" : row.mode;

  return {
    destination: row.destination,
    platform: row.platform || "1",
    departureTime: realTime,
    mode: mode as Departure["mode"],
    routeNumber: row.route_number,
    delayMinutes: delay,
    scheduledTime: schedTime,
    realTime,
    lineColor: row.line_color || getRouteHexColor(mode, row.route_number),
    lineName: row.line_name || row.route_number,
    stops: stops.map((s) => ({
      station_name: s.station_name,
      time: parseTfnswTime(s.stop_time),
    })),
  };
}

export async function getStationsFromDb(query?: string) {
  const database = await getDatabase();
  if (query) {
    const q = `%${query.toLowerCase()}%`;
    return database.getAllAsync(
      `SELECT * FROM stations WHERE LOWER(name) LIKE ? OR LOWER(code) LIKE ? ORDER BY name`,
      [q, q]
    );
  }
  return database.getAllAsync(`SELECT * FROM stations ORDER BY name`);
}

function normalizeDbMode(mode: string) {
  return mode === "lightrail" ? "light_rail" : mode;
}

function departureRowMatchesStation(row: DepRow, expectedMode: string) {
  const m = normalizeDbMode(row.mode);
  const route = row.route_number || "";

  if (expectedMode === "train") {
    if (m === "metro" || /^M\d/i.test(route)) return false;
    if (m === "train" || /^T\d/i.test(route) || /^(CCN|BMT|SCO|HUN|SPL)$/i.test(route)) {
      return true;
    }
    return false;
  }
  if (expectedMode === "metro") {
    if (m === "train" && /^T\d/i.test(route)) return false;
    if (m === "metro" || /^M\d/i.test(route)) return true;
    return false;
  }

  if (m === expectedMode) return true;
  if (expectedMode === "ferry" && /^F\d+/i.test(route)) return true;
  if (expectedMode === "train" && /^T\d/i.test(route)) return true;
  if (expectedMode === "metro" && /^M\d/i.test(route)) return true;
  if (expectedMode === "light_rail" && /^L\d+/i.test(route)) return true;
  return false;
}

async function expectedModeForStationId(stationId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ mode: string }>(
    "SELECT mode FROM stations WHERE id = ?",
    [stationId]
  );
  const fromDb = row?.mode;
  if (fromDb) return normalizeDbMode(fromDb);
  const s = SYDNEY_STATIONS.find((x) => x.id === stationId);
  if (!s) return null;
  return normalizeDbMode(s.mode);
}

export async function getDeparturesFromDb(stationId: string, limit = 10): Promise<Departure[]> {
  const database = await getDatabase();
  const expected = await expectedModeForStationId(stationId);

  const loadRows = async () =>
    database.getAllAsync<DepRow>(
      `SELECT * FROM departures WHERE station_id = ? ORDER BY scheduled_time LIMIT ?`,
      [stationId, Math.max(limit, 20)]
    );

  let rows = await loadRows();
  const modeOk =
    !expected ||
    (rows.length > 0 && rows.every((r) => departureRowMatchesStation(r, expected)));

  if (
    rows.length === 0 ||
    !modeOk ||
    trainDeparturesLookStale(stationId, rows) ||
    departuresLookTimeStale(rows)
  ) {
    await refreshNative(stationId);
    rows = await loadRows();
    if (expected) {
      rows = rows.filter((r) => departureRowMatchesStation(r, expected));
    }
  }

  return Promise.all(rows.slice(0, limit).map(mapDeparture));
}

export async function cacheDeparturesToDb(
  stationId: string,
  departures: Array<Record<string, unknown>>
) {
  const database = await getDatabase();
  await database.runAsync(
    "DELETE FROM departure_stops WHERE departure_id IN (SELECT id FROM departures WHERE station_id = ?)",
    [stationId]
  );
  await database.runAsync("DELETE FROM departures WHERE station_id = ?", [stationId]);

  for (const item of departures) {
    const id = String(item.id || `api_${stationId}_${item.routeNumber}_${Date.now()}`);
    const sched = parseTfnswTime(
      (item.scheduledTime ?? item.scheduled_time) as string
    );
    const realRaw = item.realTime ?? item.real_time;
    const real = realRaw
      ? parseTfnswTime(realRaw as string)
      : new Date(sched.getTime() + (Number(item.delayMinutes) || 0) * 60000);
    const delay =
      Number(item.delayMinutes ?? item.delay_minutes) ||
      Math.max(0, Math.round((real.getTime() - sched.getTime()) / 60000));

    const routeNumber = String(item.routeNumber ?? item.route_number ?? "—");
    const mode = String(item.mode ?? "train");
    const lineColor =
      String(item.lineColor ?? item.line_color ?? "") ||
      getRouteHexColor(mode, routeNumber);

    await database.runAsync(
      `INSERT INTO departures (id, station_id, route_number, destination, mode, platform, scheduled_time, delay_minutes, line_color, line_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        stationId,
        routeNumber,
        String(item.destination ?? ""),
        mode,
        String(item.platform || "1"),
        toIsoString(sched),
        delay,
        lineColor,
        String(item.lineName ?? item.line_name ?? routeNumber),
      ]
    );
    const stops = (item.stops as Array<{ station_name: string; time: string }>) || [];
    for (let i = 0; i < stops.length; i++) {
      const stopTime = toIsoString(parseTfnswTime(stops[i].time));
      await database.runAsync(
        `INSERT INTO departure_stops (departure_id, station_name, stop_time, sort_order) VALUES (?, ?, ?, ?)`,
        [id, stops[i].station_name, stopTime, i]
      );
    }
  }
}

export async function getAlertsFromDb(): Promise<ServiceAlert[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    title: string;
    description: string;
    mode: string;
    severity: string;
    affected_routes: string;
  }>(`SELECT * FROM alerts ORDER BY updated_at DESC`);

  return rows.map((r) => ({
    id: r.id,
    mode: (r.mode === "lightrail" ? "light_rail" : r.mode) as ServiceAlert["mode"],
    title: r.title,
    description: r.description,
    severity: r.severity as ServiceAlert["severity"],
    affectedRoutes: r.affected_routes ? r.affected_routes.split(",") : [],
  }));
}

export async function upsertAlertsToDb(alerts: ServiceAlert[]) {
  const database = await getDatabase();
  const now = new Date().toISOString();
  const slice = alerts.slice(0, 200);

  await database.withTransactionAsync(async () => {
    await database.runAsync(`DELETE FROM alerts`);
    for (const a of slice) {
      await database.runAsync(
        `INSERT OR REPLACE INTO alerts (id, title, description, mode, severity, affected_routes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.title.slice(0, 500),
          a.description.slice(0, 4000),
          a.mode,
          a.severity,
          (a.affectedRoutes ?? []).join(",").slice(0, 500),
          now,
        ]
      );
    }
  });
}

export async function getNearbyFromDb(lat: number, lng: number, radius = 2000) {
  const database = await getDatabase();
  const stations = await database.getAllAsync<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    mode: string;
  }>(`SELECT * FROM stations`);

  const nearby = stations
    .map((s) => ({
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
    const deps = await getDeparturesFromDb(stop.station_id, 1);
    result.push({ ...stop, next_departure: deps[0] || null });
  }
  return result;
}

export async function getTripsFromDb(originId: string, destId: string): Promise<TripItinerary[]> {
  const orig = SYDNEY_STATIONS.find((s) => s.id === originId) || SYDNEY_STATIONS[0];
  const dest = SYDNEY_STATIONS.find((s) => s.id === destId) || SYDNEY_STATIONS[1];
  const now = new Date();
  const itineraries: TripItinerary[] = [];

  for (let i = 0; i < 3; i++) {
    const departureTime = new Date(now.getTime() + (5 + i * 12) * 60000);
    const linesForOrigin = orig.mode === "train" ? getLinesForStation(originId) : [];
    const line =
      linesForOrigin[i % Math.max(linesForOrigin.length, 1)] ||
      SYDNEY_TRAIN_LINES.find((l) => (orig.mode === "metro" ? l.route === "M1" : l.route.startsWith("T"))) ||
      SYDNEY_TRAIN_LINES[0];
    const perStop = orig.mode === "ferry" ? 5 : orig.mode === "train" ? 3 : 4;
    const lineStops =
      orig.mode === "train"
        ? buildLineStopSequence(
            originId,
            dest.name.replace(/ Station$/, ""),
            line.route,
            departureTime,
            perStop
          )
        : [];
    const stopNames =
      lineStops.length >= 2 ? lineStops.map((s) => s.station_name) : [orig.name, dest.name];
    const duration =
      lineStops.length >= 2
        ? (lineStops.length - 1) * perStop
        : Math.max(
            6,
            Math.round(
              haversine(orig.lat ?? -33.87, orig.lon ?? 151.21, dest.lat ?? -33.87, dest.lon ?? 151.21) /
                1000 /
                40 *
                60
            )
          );
    const arrivalTime = new Date(departureTime.getTime() + duration * 60000);

    itineraries.push({
      id: `db_trip_${i}_${originId}_${destId}`,
      duration,
      departureTime,
      arrivalTime,
      transfersCount: i === 2 ? 1 : 0,
      legs: [
        {
          mode: (orig.mode === "lightrail" ? "light_rail" : orig.mode) as TripItinerary["legs"][0]["mode"],
          departure: departureTime,
          arrival: arrivalTime,
          duration,
          stops: stopNames,
          platform: `Platform ${(i % 3) + 1}`,
          routeNumber: line.route,
        },
      ],
    });
  }
  return itineraries;
}

export async function getSavedStationsFromDb() {
  const database = await getDatabase();
  return database.getAllAsync<{
    station_id: string;
    station_name: string;
    transit_mode: string;
  }>(`SELECT * FROM saved_stations ORDER BY created_at DESC`);
}

export async function saveStationToDb(station: {
  station_id: string;
  station_name: string;
  transit_mode: string;
}) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO saved_stations (station_id, station_name, transit_mode, created_at) VALUES (?, ?, ?, ?)`,
    [station.station_id, station.station_name, station.transit_mode, new Date().toISOString()]
  );
}

export async function removeStationFromDb(stationId: string) {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM saved_stations WHERE station_id = ?`, [stationId]);
}

export async function getSavedTripsFromDb() {
  const database = await getDatabase();
  return database.getAllAsync(`SELECT * FROM saved_trips ORDER BY created_at DESC`);
}

export async function saveTripToDb(trip: {
  id: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  transit_mode: string;
  route_number?: string;
  description?: string;
  frequency?: string;
}) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO saved_trips (id, origin_id, origin_name, destination_id, destination_name, transit_mode, route_number, description, frequency, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.id,
      trip.origin_id,
      trip.origin_name,
      trip.destination_id,
      trip.destination_name,
      trip.transit_mode,
      trip.route_number ?? null,
      trip.description ?? null,
      trip.frequency ?? null,
      new Date().toISOString(),
    ]
  );
}

export async function removeTripFromDb(tripId: string) {
  const database = await getDatabase();
  await database.runAsync(`DELETE FROM saved_trips WHERE id = ?`, [tripId]);
}

export async function addRecentSearchToDb(query: string) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT OR REPLACE INTO recent_searches (query, searched_at) VALUES (?, ?)`,
    [query, new Date().toISOString()]
  );
  const all = await database.getAllAsync<{ query: string }>(
    `SELECT query FROM recent_searches ORDER BY searched_at DESC`
  );
  if (all.length > 10) {
    for (const row of all.slice(10)) {
      await database.runAsync(`DELETE FROM recent_searches WHERE query = ?`, [row.query]);
    }
  }
}

export async function getRecentSearchesFromDb(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ query: string }>(
    `SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT 8`
  );
  return rows.map((r) => r.query);
}

export async function addTripHistory(originId: string, destId: string, duration: number) {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO trip_history (id, origin_id, destination_id, duration_minutes, planned_at) VALUES (?, ?, ?, ?, ?)`,
    [`hist_${Date.now()}`, originId, destId, duration, new Date().toISOString()]
  );
}

export async function getDbStats() {
  const database = await getDatabase();
  const stations = await database.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM stations");
  const departures = await database.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM departures");
  const alerts = await database.getFirstAsync<{ c: number }>("SELECT COUNT(*) as c FROM alerts");
  return {
    stations: stations?.c ?? 0,
    departures: departures?.c ?? 0,
    alerts: alerts?.c ?? 0,
  };
}

export { refreshNative as refreshDeparturesInDb };
