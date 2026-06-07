/**
 * Build weekday bus timetables from TfNSW GTFS Complete (routes synced via sync:bus-network).
 *
 *   npm run sync:bus-network
 *   npm run merge:bus-gtfs-timetables
 */
import fs from "fs";
import path from "path";
import { buildBusNetwork } from "./sync-bus-network.mjs";
import { prepareGtfsDir, readCsv, root, routeMode } from "./gtfs-shared.mjs";

const TIMETABLES_DIR = path.join(root, "backend", "data", "timetables");
const OUT_FILE = "bus-weekday.json";
const TRIP_SEQUENCES_FILE = "bus-trip-sequences.json";

function parseGtfsTime(raw) {
  const parts = String(raw || "").trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildParentMap(gtfsDir) {
  const parentByStopId = {};
  const stopsPath = path.join(gtfsDir, "stops.txt");
  return readCsv(stopsPath, (s) => {
    const id = String(s.stop_id || "").trim();
    const parent = String(s.parent_station || "").trim();
    if (id && parent) parentByStopId[id] = parent;
  }).then(() => parentByStopId);
}

function resolveAppId(stopId, gtfsToApp, parentByStopId) {
  let cur = String(stopId || "").trim();
  for (let i = 0; i < 8; i++) {
    if (gtfsToApp[cur]) return gtfsToApp[cur];
    const parent = parentByStopId[cur];
    if (!parent) break;
    cur = parent;
  }
  return null;
}

export async function mergeBusGtfsTimetables(gtfsDir, network) {
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");
  const parentByStopId = await buildParentMap(gtfsDir);

  const gtfsToApp = network.gtfsToAppId || {};
  const stopNameByAppId = Object.fromEntries((network.stops || []).map((s) => [s.id, s.name]));

  const appRoutes = new Set((network.branches || []).map((b) => b.route));
  const busRouteIds = {};
  await readCsv(routesPath, (r) => {
    if (routeMode(r) !== "bus") return;
    const short = String(r.route_short_name || "").trim();
    if (!appRoutes.has(short)) return;
    busRouteIds[r.route_id] = short;
  });

  const tripsByRoute = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    const route = busRouteIds[route_id];
    if (!route) return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    if (!tripsByRoute.has(route)) tripsByRoute.set(route, new Set());
    tripsByRoute.get(route).add(trip_id);
  });

  const wantedTripIds = new Set([...tripsByRoute.values()].flatMap((s) => [...s]));
  console.log("Bus trips to parse:", wantedTripIds.size);

  const seqByTrip = new Map();
  await readCsv(stopTimesPath, (st) => {
    const trip_id = String(st.trip_id || "").trim();
    if (!wantedTripIds.has(trip_id)) return;
    const stop_id = String(st.stop_id || "").trim();
    if (!stop_id) return;
    const seq = Number(st.stop_sequence || 0);
    const dep = parseGtfsTime(st.departure_time);
    if (!dep) return;
    if (!seqByTrip.has(trip_id)) seqByTrip.set(trip_id, []);
    seqByTrip.get(trip_id).push({ stop_id, seq, dep });
  });

  function tripDestination(seq) {
    for (let i = seq.length - 1; i >= 0; i--) {
      const appId = resolveAppId(seq[i].stop_id, gtfsToApp, parentByStopId);
      if (!appId) continue;
      const name = stopNameByAppId[appId];
      if (name) return String(name).trim();
    }
    return "Bus";
  }

  const payload = { stations: {}, source: "gtfs", mode: "bus" };
  /** @type {Record<string, Map<string, object>>} */
  const templatesByRoute = {};

  function minuteOffset(fromHhmm, toHhmm) {
    const toMin = (raw) => {
      const [h, m] = String(raw).split(":").map(Number);
      let t = (h || 0) * 60 + (m || 0);
      while (t >= 24 * 60) t -= 24 * 60;
      return t;
    };
    return toMin(toHhmm) - toMin(fromHhmm);
  }

  for (const tripId of wantedTripIds) {
    const seq = (seqByTrip.get(tripId) || []).sort((a, b) => a.seq - b.seq);
    if (seq.length < 2) continue;
    const route = [...tripsByRoute.entries()].find(([, set]) => set.has(tripId))?.[0];
    if (!route) continue;
    const dest = tripDestination(seq);
    const stopIds = [];
    const times = [];
    for (const row of seq) {
      const appId = resolveAppId(row.stop_id, gtfsToApp, parentByStopId);
      if (!appId) continue;
      stopIds.push(appId);
      times.push(row.dep);
    }
    if (stopIds.length >= 2) {
      const shapeKey = `${dest}|${stopIds.join(",")}`;
      if (!templatesByRoute[route]) templatesByRoute[route] = new Map();
      if (!templatesByRoute[route].has(shapeKey)) {
        const originTime = times[0];
        templatesByRoute[route].set(shapeKey, {
          destination: dest,
          stopIds,
          originTime,
          offsetsMin: times.map((t) => minuteOffset(originTime, t)),
        });
      }
    }

    for (const row of seq) {
      const appId = resolveAppId(row.stop_id, gtfsToApp, parentByStopId);
      if (!appId) continue;
      if (!payload.stations[appId]) payload.stations[appId] = { departures: [] };
      const list = payload.stations[appId].departures;
      const key = `${row.dep}|${route}|${dest}`;
      if (list.some((d) => `${d.scheduledTime}|${d.routeNumber}|${d.destination}` === key)) continue;
      list.push({
        scheduledTime: row.dep,
        destination: dest,
        routeNumber: route,
        direction: "outbound",
        source: "gtfs",
      });
    }
  }

  for (const entry of Object.values(payload.stations)) {
    entry.departures.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const seen = new Set();
    entry.departures = entry.departures.filter((d) => {
      const k = `${d.scheduledTime}|${d.routeNumber}|${d.destination}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  const byRoute = {};
  for (const [route, map] of Object.entries(templatesByRoute)) {
    byRoute[route] = [...map.values()];
  }

  fs.mkdirSync(TIMETABLES_DIR, { recursive: true });
  fs.writeFileSync(path.join(TIMETABLES_DIR, OUT_FILE), JSON.stringify(payload));
  fs.writeFileSync(
    path.join(TIMETABLES_DIR, TRIP_SEQUENCES_FILE),
    JSON.stringify({ builtAt: new Date().toISOString(), byRoute })
  );
  const withDeps = Object.values(payload.stations).filter((s) => s.departures?.length).length;
  const templateCount = Object.values(byRoute).reduce((n, arr) => n + arr.length, 0);
  console.log(`  bus: ${withDeps} stops with departures → ${OUT_FILE}`);
  console.log(`  bus trip sequences: ${templateCount} templates → ${TRIP_SEQUENCES_FILE}`);
}

if (
  process.argv[1] &&
  process.argv[1].toLowerCase().includes("merge-bus-gtfs-timetables")
) {
  const gtfsDir = await prepareGtfsDir();
  const network = await buildBusNetwork(gtfsDir);
  await mergeBusGtfsTimetables(gtfsDir, network);
  const { rebuildTimetableIndex } = await import("../backend/data/timetableLoader.js");
  rebuildTimetableIndex();
  console.log("Timetable index rebuilt.");
}
