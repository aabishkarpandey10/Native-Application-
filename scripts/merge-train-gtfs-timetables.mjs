/**
 * Supplement T1–T9 / CCN / BMT / SCO PDF timetables with GTFS stop_times where gaps exist.
 *
 *   npm run merge:train-gtfs-timetables
 */
import fs from "fs";
import path from "path";
import { buildTrainNetworkFromGtfs } from "./sync-train-network-gtfs.mjs";
import { prepareGtfsDir, readCsv, root } from "./gtfs-shared.mjs";

const TIMETABLES_DIR = path.join(root, "backend", "data", "timetables");

const TRAIN_LINES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "CCN", "BMT", "SCO"];

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
  return readCsv(path.join(gtfsDir, "stops.txt"), (s) => {
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

function tripDestination(seq, gtfsToApp, parentByStopId, stopNameByAppId) {
  for (let i = seq.length - 1; i >= 0; i--) {
    const appId = resolveAppId(seq[i].stop_id, gtfsToApp, parentByStopId);
    if (!appId) continue;
    const name = stopNameByAppId[appId];
    if (name) {
      return name.replace(/\s+Station$/i, "").trim();
    }
  }
  return "Train";
}

export async function mergeTrainGtfsTimetables(gtfsDir, network) {
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");
  const parentByStopId = await buildParentMap(gtfsDir);

  const routeIdToCode = {};
  await readCsv(routesPath, (r) => {
    const short = String(r.route_short_name || "").trim().toUpperCase();
    if (TRAIN_LINES.includes(short)) routeIdToCode[r.route_id] = short;
  });

  const tripsByCode = new Map();
  await readCsv(tripsPath, (t) => {
    const code = routeIdToCode[t.route_id];
    if (!code) return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    if (!tripsByCode.has(code)) tripsByCode.set(code, new Set());
    tripsByCode.get(code).add(trip_id);
  });

  const wantedTrips = new Set([...tripsByCode.values()].flatMap((s) => [...s]));
  const seqByTrip = new Map();
  await readCsv(stopTimesPath, (st) => {
    const trip_id = String(st.trip_id || "").trim();
    if (!wantedTrips.has(trip_id)) return;
    const stop_id = String(st.stop_id || "").trim();
    const seq = Number(st.stop_sequence || 0);
    const dep = parseGtfsTime(st.departure_time);
    if (!dep) return;
    if (!seqByTrip.has(trip_id)) seqByTrip.set(trip_id, []);
    seqByTrip.get(trip_id).push({ stop_id, seq, dep });
  });

  const gtfsToApp = network.gtfsToAppId || {};
  const stopNameByAppId = Object.fromEntries(
    (network.stops || []).map((s) => [s.id, s.name])
  );

  for (const code of TRAIN_LINES) {
    const tripIds = tripsByCode.get(code);
    if (!tripIds?.size) continue;

    const filePath = path.join(TIMETABLES_DIR, `${code.toLowerCase()}-weekday.json`);
    let payload = { stations: {} };
    if (fs.existsSync(filePath)) {
      payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    if (!payload.stations) payload.stations = {};

    for (const tripId of tripIds) {
      const seq = (seqByTrip.get(tripId) || []).sort((a, b) => a.seq - b.seq);
      if (seq.length < 2) continue;
      const dest = tripDestination(seq, gtfsToApp, parentByStopId, stopNameByAppId);

      for (const row of seq) {
        const appId = resolveAppId(row.stop_id, gtfsToApp, parentByStopId);
        if (!appId) continue;
        if (!payload.stations[appId]) payload.stations[appId] = { departures: [] };
        const list = payload.stations[appId].departures;
        const key = `${row.dep}|${code}|${dest}`;
        if (list.some((d) => `${d.scheduledTime}|${d.routeNumber}|${d.destination}` === key)) {
          continue;
        }
        list.push({
          scheduledTime: row.dep,
          destination: dest,
          routeNumber: code,
          direction: "outbound",
          source: "gtfs",
        });
      }
    }

    const branchIds = network.lineStationIds?.[code] || [];
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
        (r) => String(r.routeNumber || "").toUpperCase() === code
      );
      if (!donorRows.length) continue;

      payload.stations[stationId] = {
        departures: donorRows.map((row) => {
          const [h, m] = String(row.scheduledTime || "00:00").split(":").map(Number);
          let total = h * 60 + m + offsetMin;
          while (total < 0) total += 24 * 60;
          while (total >= 24 * 60) total -= 24 * 60;
          return {
            ...row,
            scheduledTime: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`,
            source: "branch-fill",
          };
        }),
      };
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

    fs.mkdirSync(TIMETABLES_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload));
    const withDeps = Object.values(payload.stations).filter((s) => s.departures?.length).length;
    console.log(`  ${code}: ${withDeps} stops with departures`);
  }
}

if (process.argv[1]?.toLowerCase().includes("merge-train-gtfs-timetables")) {
  const gtfsDir = await prepareGtfsDir();
  const network = await buildTrainNetworkFromGtfs(gtfsDir);
  await mergeTrainGtfsTimetables(gtfsDir, network);
  const { rebuildTimetableIndex } = await import("../backend/data/timetableLoader.js");
  rebuildTimetableIndex();
  console.log("Timetable index rebuilt.");
}
