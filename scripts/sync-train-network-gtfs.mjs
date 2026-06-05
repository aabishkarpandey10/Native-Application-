/**
 * Build Sydney Trains + Intercity (CCN/BMT/SCO) network from TfNSW GTFS Complete.
 * Preserves legacy *_T station IDs and hand-crafted branches from trainNetworkData.js.
 *
 *   npm run sync:train-network-gtfs
 */
import fs from "fs";
import path from "path";
import {
  inGreaterSydney,
  loadEnv,
  pickRouteColor,
  prepareGtfsDir,
  readCsv,
  root,
} from "./gtfs-shared.mjs";
import {
  GREATER_SYDNEY_TRAIN_STATIONS,
  TRAIN_LINE_BRANCHES as LEGACY_BRANCHES,
} from "../backend/data/trainNetworkData.js";

loadEnv();

const TRAIN_ROUTE_CODES = new Set([
  "T1",
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "T8",
  "T9",
  "CCN",
  "BMT",
  "SCO",
]);

/** NSW corridor for intercity endpoints (Newcastle, Kiama, Lithgow). */
function inNswTrainCorridor(lat, lon) {
  return lat >= -37.8 && lat <= -32.2 && lon >= 148.8 && lon <= 152.3;
}

function normKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/,\s*nsw.*$/i, "")
    .replace(/\s+station$/i, "")
    .replace(/\s+interchange$/i, "")
    .replace(/\s+metro$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isTrainNetworkRoute(r) {
  const type = Number(r.route_type);
  if (type !== 2) return false;
  const short = String(r.route_short_name || "")
    .trim()
    .toUpperCase();
  if (TRAIN_ROUTE_CODES.has(short)) return true;
  const desc = String(r.route_desc || r.route_long_name || "").toLowerCase();
  if (desc.includes("sydney trains") || desc.includes("intercity trains")) return true;
  return false;
}

function displayRouteCode(short) {
  const m = String(short || "").match(/^(T\d+|CCN|BMT|SCO)/i);
  return m ? m[1].toUpperCase() : String(short || "").toUpperCase();
}

function displayStopName(name) {
  const base = String(name || "")
    .replace(/,\s*NSW.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/station$/i.test(base)) return base;
  return `${base} Station`;
}

/** Legacy *_T IDs from existing network. */
const LEGACY_TRAIN_BY_NORM = Object.fromEntries(
  GREATER_SYDNEY_TRAIN_STATIONS.map((s) => [normKey(s.name), s.id])
);
for (const s of GREATER_SYDNEY_TRAIN_STATIONS) {
  const compact = normKey(s.name).replace(/\s+/g, "");
  LEGACY_TRAIN_BY_NORM[compact] = s.id;
}

function resolveLegacyId(name) {
  const key = normKey(name);
  if (LEGACY_TRAIN_BY_NORM[key]) return LEGACY_TRAIN_BY_NORM[key];
  const compact = key.replace(/\s+/g, "");
  if (LEGACY_TRAIN_BY_NORM[compact]) return LEGACY_TRAIN_BY_NORM[compact];
  if (/metro/i.test(name)) return null;
  return null;
}

function toAppId(name, used) {
  const legacy = resolveLegacyId(name);
  if (legacy) {
    used.add(legacy);
    return legacy;
  }
  if (/metro/i.test(name)) return null;

  const base =
    String(name || "STOP")
      .replace(/,\s*[^,]+$/i, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 28) || "STOP";
  let id = `${base}_T`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}${n}_T`;
    n += 1;
  }
  used.add(id);
  return id;
}

function toCode(appId) {
  return appId.replace(/_T$/, "").slice(0, 6);
}

function resolveStopId(rawId, stopsById, parentByStopId) {
  const parent = parentByStopId[rawId];
  if (parent && stopsById[parent]) return parent;
  return rawId;
}

function isMetroOnlyStop(name) {
  return /metro/i.test(name) && !/interchange/i.test(name);
}

export async function buildTrainNetworkFromGtfs(gtfsDir) {
  const stopsPath = path.join(gtfsDir, "stops.txt");
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");

  const stopsById = {};
  const parentByStopId = {};
  await readCsv(stopsPath, (s) => {
    const id = String(s.stop_id || "").trim();
    if (!id) return;
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const name = String(s.stop_name || "").trim();
    if (!name || isMetroOnlyStop(name)) return;
    const parent = String(s.parent_station || "").trim();
    if (parent) parentByStopId[id] = parent;
    stopsById[id] = { id, name, lat, lon };
  });

  const trainRoutes = {};
  await readCsv(routesPath, (r) => {
    if (!isTrainNetworkRoute(r)) return;
    const id = String(r.route_id || "").trim();
    const short = displayRouteCode(r.route_short_name);
    if (!TRAIN_ROUTE_CODES.has(short)) return;
    trainRoutes[id] = {
      route_id: id,
      short,
      long: String(r.route_long_name || "").trim(),
      color: pickRouteColor("train", r.route_color),
    };
  });
  console.log("Train/intercity routes:", Object.keys(trainRoutes).length);

  const tripMeta = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    if (!trainRoutes[route_id]) return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    const dir = String(t.direction_id ?? "0").trim() || "0";
    tripMeta.set(trip_id, { route_id, dir });
  });

  const repTripByKey = new Map();
  const seqByTrip = new Map();

  await readCsv(stopTimesPath, (st) => {
    const trip_id = String(st.trip_id || "").trim();
    const meta = tripMeta.get(trip_id);
    if (!meta) return;
    const stop_id = String(st.stop_id || "").trim();
    if (!stop_id) return;
    const stop_sequence = Number(st.stop_sequence || 0);
    if (!seqByTrip.has(trip_id)) seqByTrip.set(trip_id, []);
    seqByTrip.get(trip_id).push({ stop_id, stop_sequence });

    const key = `${meta.route_id}|${meta.dir}`;
    const prev = repTripByKey.get(key);
    const len = (seqByTrip.get(trip_id) || []).length;
    if (!prev || len > prev.len) repTripByKey.set(key, { trip_id, len });
  });

  const usedAppIds = new Set(Object.keys(
    Object.fromEntries(GREATER_SYDNEY_TRAIN_STATIONS.map((s) => [s.id, 1]))
  ));
  const gtfsToApp = {};
  const stopRecords = new Map();

  for (const s of GREATER_SYDNEY_TRAIN_STATIONS) {
    stopRecords.set(s.id, {
      id: s.id,
      name: displayStopName(s.name),
      lat: s.lat,
      lon: s.lon,
      code: s.code || toCode(s.id),
      tfnswStopId: s.tfnswStopId,
    });
    if (s.tfnswStopId) gtfsToApp[s.tfnswStopId] = s.id;
  }

  const ensureAppStop = (gtfsId) => {
    const resolved = resolveStopId(gtfsId, stopsById, parentByStopId);
    const canonical = stopsById[resolved] ? resolved : gtfsId;
    if (gtfsToApp[canonical]) {
      return { appId: gtfsToApp[canonical], stop: stopRecords.get(gtfsToApp[canonical]) };
    }
    const stop = stopsById[canonical] || stopsById[gtfsId];
    if (!stop) return null;
    if (!inGreaterSydney(stop.lat, stop.lon) && !inNswTrainCorridor(stop.lat, stop.lon)) {
      return null;
    }
    const appId = toAppId(stop.name, usedAppIds);
    if (!appId) return null;
    gtfsToApp[canonical] = appId;
    gtfsToApp[gtfsId] = appId;
    const rec = {
      id: appId,
      name: displayStopName(stop.name),
      lat: stop.lat,
      lon: stop.lon,
      code: toCode(appId),
      tfnswStopId: canonical,
    };
    stopRecords.set(appId, rec);
    return { appId, stop: rec };
  };

  const gtfsBranches = [];
  const seenBranch = new Set();

  for (const [key, { trip_id }] of repTripByKey.entries()) {
    const [route_id, dir] = key.split("|");
    const route = trainRoutes[route_id];
    const seq = (seqByTrip.get(trip_id) || [])
      .sort((a, b) => a.stop_sequence - b.stop_sequence)
      .map((x) => resolveStopId(x.stop_id, stopsById, parentByStopId))
      .filter(Boolean);

    const stationIds = [];
    for (const gid of seq) {
      const mapped = ensureAppStop(gid);
      if (!mapped?.appId) continue;
      const { appId } = mapped;
      if (stationIds[stationIds.length - 1] !== appId) stationIds.push(appId);
    }
    if (stationIds.length < 2) continue;

    const branchKey = `${route.short}|${dir}|${stationIds.join(",")}`;
    if (seenBranch.has(branchKey)) continue;
    seenBranch.add(branchKey);

    gtfsBranches.push({
      id: `gtfs_${route.short}_${route_id.replace(/[^A-Za-z0-9]/g, "_")}_${dir}`,
      route: route.short,
      name: `${route.long || route.short} (GTFS dir ${dir})`,
      color: route.color,
      stationIds,
      direction: dir === "1" ? "return" : "outbound",
      source: "gtfs",
    });
  }

  for (const [stopId, parent] of Object.entries(parentByStopId)) {
    const resolved = resolveStopId(stopId, stopsById, parentByStopId);
    const appId = gtfsToApp[resolved] || gtfsToApp[parent];
    if (appId) {
      gtfsToApp[stopId] = appId;
      if (parent) gtfsToApp[parent] = appId;
    }
  }

  const validIds = new Set(stopRecords.keys());
  const curatedBranches = LEGACY_BRANCHES.map((b) => ({
    ...b,
    stationIds: b.stationIds.filter((id) => validIds.has(id)),
  })).filter((b) => b.stationIds.length >= 2);

  const lineBranches = [...curatedBranches];
  const branchIds = new Set(curatedBranches.map((b) => b.id));
  for (const b of gtfsBranches) {
    if (branchIds.has(b.id)) continue;
    lineBranches.push({
      id: b.id,
      route: b.route,
      name: b.name,
      color: b.color,
      stationIds: b.stationIds,
    });
    branchIds.add(b.id);
  }

  const lineStationIds = {};
  for (const branch of lineBranches) {
    if (!lineStationIds[branch.route]) lineStationIds[branch.route] = [];
    for (const sid of branch.stationIds) {
      if (!lineStationIds[branch.route].includes(sid)) {
        lineStationIds[branch.route].push(sid);
      }
    }
  }

  const stops = [...stopRecords.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    source: "tfnsw-gtfs-complete",
    stops,
    branches: lineBranches,
    lineStationIds,
    gtfsToAppId: gtfsToApp,
    stats: {
      stops: stops.length,
      branches: lineBranches.length,
      curatedBranches: curatedBranches.length,
      gtfsBranches: gtfsBranches.length,
      routes: Object.keys(lineStationIds).length,
    },
  };
}

function writeOutputs(payload) {
  const backendPath = path.join(root, "backend", "data", "trainNetworkData.js");
  const js = `/** Auto-generated — npm run sync:train-network-gtfs */
export const GREATER_SYDNEY_TRAIN_STATIONS = ${JSON.stringify(payload.stops)};

export const TRAIN_LINE_BRANCHES = ${JSON.stringify(payload.branches, null, 2)};

export const STATION_BY_ID = Object.fromEntries(
  GREATER_SYDNEY_TRAIN_STATIONS.map((s) => [s.id, s])
);

export const LINE_STATION_IDS = ${JSON.stringify(payload.lineStationIds, null, 2)};

export const TRAIN_GTFS_TO_APP_ID = ${JSON.stringify(payload.gtfsToAppId)};

export function getLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of TRAIN_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return [...routes];
}
`;
  fs.writeFileSync(backendPath, js, "utf8");

  const outDir = path.join(root, "src", "constants", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "trainNetwork.json"),
    JSON.stringify(
      {
        stations: payload.stops.map((s) => ({ ...s, mode: "train" })),
        branches: payload.branches,
        lineStationIds: payload.lineStationIds,
      },
      null,
      2
    )
  );

  console.log("Stats:", payload.stats);
  console.log(`Wrote backend/data/trainNetworkData.js + src/constants/generated/trainNetwork.json`);
}

if (
  process.argv[1] &&
  process.argv[1].toLowerCase().includes("sync-train-network-gtfs")
) {
  const gtfsDir = await prepareGtfsDir();
  writeOutputs(await buildTrainNetworkFromGtfs(gtfsDir));
}
