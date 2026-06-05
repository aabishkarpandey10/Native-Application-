/**
 * Build M1 weekday timetables from TfNSW GTFS stop_times (Transport NSW has no M1 PDF).
 *
 *   npm run merge:metro-gtfs-timetables
 */
import fs from "fs";
import path from "path";
import { buildMetroNetwork } from "./sync-metro-network.mjs";
import { prepareGtfsDir, readCsv, root } from "./gtfs-shared.mjs";

const TIMETABLES_DIR = path.join(root, "backend", "data", "timetables");
const METRO_ROUTES = ["M1"];

function parseGtfsTime(raw) {
  const parts = String(raw || "").trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function terminalName(stationIds, appStops) {
  const lastId = stationIds[stationIds.length - 1];
  const firstId = stationIds[0];
  const last = appStops.find((s) => s.id === lastId);
  const first = appStops.find((s) => s.id === firstId);
  const strip = (n) =>
    String(n || "")
      .replace(/\s+Station$/i, "")
      .replace(/\s+Metro$/i, "")
      .trim();
  return strip(last?.name) || strip(first?.name) || "M1";
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

export async function mergeMetroGtfsTimetables(gtfsDir, network) {
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");
  const parentByStopId = await buildParentMap(gtfsDir);

  const metroRouteIds = {};
  await readCsv(routesPath, (r) => {
    const short = String(r.route_short_name || "").trim().toUpperCase();
    if (!METRO_ROUTES.includes(short)) return;
    metroRouteIds[r.route_id] = short;
  });

  const tripsByRoute = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    const route = metroRouteIds[route_id];
    if (!route) return;
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

  const stopNameByAppId = Object.fromEntries(appStops.map((s) => [s.id, s.name]));

  function tripDestination(seq) {
    for (let i = seq.length - 1; i >= 0; i--) {
      const appId = resolveAppId(seq[i].stop_id, gtfsToApp, parentByStopId);
      if (!appId) continue;
      const name = stopNameByAppId[appId];
      if (name) {
        return String(name)
          .replace(/\s+Station$/i, "")
          .replace(/\s+Metro$/i, "")
          .trim();
      }
    }
    return "M1";
  }

  for (const route of METRO_ROUTES) {
    const tripIds = tripsByRoute.get(route);
    if (!tripIds?.size) continue;

    const filePath = path.join(TIMETABLES_DIR, `${route.toLowerCase()}-weekday.json`);

    const payload = { stations: {} };

    for (const tripId of tripIds) {
      const seq = (seqByTrip.get(tripId) || []).sort((a, b) => a.seq - b.seq);
      if (seq.length < 2) continue;
      const dest = tripDestination(seq);
      for (const row of seq) {
        const appId = resolveAppId(row.stop_id, gtfsToApp, parentByStopId);
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

    const branchIds = network.lineStationIds?.[route] || [];
    for (let idx = 0; idx < branchIds.length; idx++) {
      const stationId = branchIds[idx];
      if (payload.stations[stationId]?.departures?.length) continue;

      let donorId = null;
      let donorIdx = -1;
      for (let d = 1; d < branchIds.length; d++) {
        if (branchIds[idx - d] && payload.stations[branchIds[idx - d]]?.departures?.length) {
          donorId = branchIds[idx - d];
          donorIdx = idx - d;
          break;
        }
        if (branchIds[idx + d] && payload.stations[branchIds[idx + d]]?.departures?.length) {
          donorId = branchIds[idx + d];
          donorIdx = idx + d;
          break;
        }
      }
      if (!donorId) continue;

      const offsetMin = (idx - donorIdx) * 3;
      const donorRows = payload.stations[donorId].departures.filter(
        (r) => String(r.routeNumber || "").toUpperCase() === route
      );
      if (!donorRows.length) continue;

      payload.stations[stationId] = {
        departures: donorRows.map((row) => {
          const [h, m] = String(row.scheduledTime || "00:00").split(":").map(Number);
          let total = h * 60 + m + offsetMin;
          while (total < 0) total += 24 * 60;
          while (total >= 24 * 60) total -= 24 * 60;
          const hh = String(Math.floor(total / 60)).padStart(2, "0");
          const mm = String(total % 60).padStart(2, "0");
          return {
            ...row,
            scheduledTime: `${hh}:${mm}`,
            source: "branch-fill",
          };
        }),
      };
    }

    fs.mkdirSync(TIMETABLES_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload));
    const withDeps = Object.values(payload.stations).filter((s) => s.departures?.length).length;
    console.log(`  ${route}: ${withDeps} stops with departures (GTFS + branch-fill)`);
  }
}

if (
  process.argv[1] &&
  process.argv[1].toLowerCase().includes("merge-metro-gtfs-timetables")
) {
  const gtfsDir = await prepareGtfsDir();
  const network = await buildMetroNetwork(gtfsDir);
  await mergeMetroGtfsTimetables(gtfsDir, network);
  const { rebuildTimetableIndex } = await import("../backend/data/timetableLoader.js");
  rebuildTimetableIndex();
  console.log("Timetable index rebuilt.");
}
