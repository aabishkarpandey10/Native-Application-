/**
 * Supplement L1/L2/L3 PDF timetables with GTFS stop_times for every stop on each branch.
 * Fills gaps (e.g. Capitol Square, Paddy's Markets) and keeps load fast via small JSON files.
 *
 *   node scripts/merge-lr-gtfs-timetables.mjs
 */
import fs from "fs";
import path from "path";
import { buildLightRailNetwork } from "./sync-light-rail-network.mjs";
import { prepareGtfsDir, readCsv, root } from "./gtfs-shared.mjs";

const TIMETABLES_DIR = path.join(root, "backend", "data", "timetables");
const LR_ROUTES = ["L1", "L2", "L3"];

function parseGtfsTime(raw) {
  const parts = String(raw || "").trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parts[2] ? parseInt(parts[2], 10) : 0;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function terminalName(route, stationIds, appStops) {
  const lastId = stationIds[stationIds.length - 1];
  const firstId = stationIds[0];
  const last = appStops.find((s) => s.id === lastId);
  const first = appStops.find((s) => s.id === firstId);
  return (
    last?.name?.replace(/\s+Light Rail.*$/i, "").trim() ||
    first?.name?.replace(/\s+Light Rail.*$/i, "").trim() ||
    route
  );
}

export async function mergeLightRailGtfsTimetables(gtfsDir, network) {
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");

  const lrRouteIds = {};
  await readCsv(routesPath, (r) => {
    const short = String(r.route_short_name || "").trim().toUpperCase();
    if (!LR_ROUTES.includes(short)) return;
    lrRouteIds[r.route_id] = short;
  });

  const tripsByRoute = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    const route = lrRouteIds[route_id];
    if (!route) return;
    const dir = String(t.direction_id ?? "0").trim() || "0";
    if (dir !== "0") return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    if (!tripsByRoute.has(route)) tripsByRoute.set(route, new Set());
    tripsByRoute.get(route).add(trip_id);
  });

  const wantedTripIds = new Set([...tripsByRoute.values()].flatMap((s) => [...s]));

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

  const gtfsToApp = network.gtfsToAppId || {};
  const appStops = network.stops || [];

  for (const route of LR_ROUTES) {
    const tripIds = tripsByRoute.get(route);
    const branch = network.branches.find((b) => b.route === route && b.direction === "outbound");
    if (!tripIds?.size || !branch) continue;

    const dest = terminalName(route, branch.stationIds, appStops);
    const filePath = path.join(TIMETABLES_DIR, `${route.toLowerCase()}-weekday.json`);

    let payload = { stations: {} };
    if (fs.existsSync(filePath)) {
      payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    if (!payload.stations) payload.stations = {};

    for (const tripId of tripIds) {
      const seq = (seqByTrip.get(tripId) || []).sort((a, b) => a.seq - b.seq);
      for (const row of seq) {
        const appId = gtfsToApp[row.stop_id];
        if (!appId) continue;
        if (!payload.stations[appId]) payload.stations[appId] = { departures: [] };
        const list = payload.stations[appId].departures;
        const key = `${row.dep}|${route}|${dest}`;
        if (list.some((d) => `${d.scheduledTime}|${d.routeNumber}|${d.destination}` === key)) {
          continue;
        }
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

    fs.writeFileSync(filePath, JSON.stringify(payload));
    console.log(
      `  ${route}: ${Object.keys(payload.stations).length} stops with departures (GTFS merged)`
    );
  }
}

if (
  process.argv[1] &&
  process.argv[1].toLowerCase().includes("merge-lr-gtfs-timetables")
) {
  const gtfsDir = await prepareGtfsDir();
  const network = await buildLightRailNetwork(gtfsDir);
  await mergeLightRailGtfsTimetables(gtfsDir, network);
  const { rebuildTimetableIndex } = await import("../backend/data/timetableLoader.js");
  rebuildTimetableIndex();
  console.log("Timetable index rebuilt.");
}
