/**
 * Build Greater Sydney bus stops + all bus routes from TfNSW GTFS Complete.
 *
 *   npm run sync:bus-network
 *
 * Requires TFNSW_API_KEY in .env
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
  routeMode,
} from "./gtfs-shared.mjs";

loadEnv();

function normalizeBusStopName(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

function toAppId(name, used) {
  const base =
    String(name || "STOP")
      .replace(/\s*,\s*[^,]+$/i, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 32) || "STOP";
  let id = `${base}_B`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}${n}_B`;
    n += 1;
  }
  used.add(id);
  return id;
}

function toCode(appId) {
  return appId.replace(/_B$/, "").slice(0, 6);
}

function resolveStopId(rawId, stopsById, parentByStopId) {
  const parent = parentByStopId[rawId];
  if (parent && stopsById[parent]) return parent;
  return rawId;
}

export async function buildBusNetwork(gtfsDir) {
  const stopsPath = path.join(gtfsDir, "stops.txt");
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");

  console.log("Parsing bus stops in Greater Sydney…");
  const stopsById = {};
  const parentByStopId = {};
  await readCsv(stopsPath, (s) => {
    const id = String(s.stop_id || "").trim();
    if (!id) return;
    const lat = Number(s.stop_lat);
    const lon = Number(s.stop_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!inGreaterSydney(lat, lon)) return;

    const parent = String(s.parent_station || "").trim();
    if (parent) parentByStopId[id] = parent;

    const name = normalizeBusStopName(s.stop_name);
    if (!name) return;

    stopsById[id] = { id, name, lat, lon };
  });
  console.log("Sydney stops loaded:", Object.keys(stopsById).length);

  const busRoutes = {};
  await readCsv(routesPath, (r) => {
    const id = String(r.route_id || "").trim();
    if (!id) return;
    const mode = routeMode(r);
    if (mode !== "bus") return;
    const short = String(r.route_short_name || "").trim() || id;
    busRoutes[id] = {
      route_id: id,
      short,
      long: String(r.route_long_name || "").trim(),
      color: pickRouteColor("bus", r.route_color),
    };
  });
  console.log("Bus routes:", Object.keys(busRoutes).length);

  const repTripByRouteDir = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    if (!busRoutes[route_id]) return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    const dir = String(t.direction_id ?? "0").trim() || "0";
    const key = `${route_id}|${dir}`;
    if (!repTripByRouteDir.has(key)) repTripByRouteDir.set(key, trip_id);
  });
  console.log("Bus route directions:", repTripByRouteDir.size);

  const wantedTripIds = new Set(repTripByRouteDir.values());
  const seqByTrip = new Map();
  console.log("Parsing stop sequences…");
  await readCsv(stopTimesPath, (st) => {
    const trip_id = String(st.trip_id || "").trim();
    if (!wantedTripIds.has(trip_id)) return;
    const stop_id = String(st.stop_id || "").trim();
    if (!stop_id) return;
    const stop_sequence = Number(st.stop_sequence || 0);
    if (!seqByTrip.has(trip_id)) seqByTrip.set(trip_id, []);
    seqByTrip.get(trip_id).push({ stop_id, stop_sequence });
  });

  const usedAppIds = new Set();
  const gtfsToApp = {};
  const stopRecords = new Map();

  const ensureAppStop = (gtfsId) => {
    const resolved = resolveStopId(gtfsId, stopsById, parentByStopId);
    const canonical = stopsById[resolved] ? resolved : gtfsId;
    if (gtfsToApp[canonical]) {
      const appId = gtfsToApp[canonical];
      return { appId, stop: stopRecords.get(appId) };
    }
    const stop = stopsById[canonical] || stopsById[gtfsId];
    if (!stop) return null;
    const appId = toAppId(stop.name, usedAppIds);
    gtfsToApp[canonical] = appId;
    gtfsToApp[gtfsId] = appId;
    const rec = {
      id: appId,
      name: stop.name,
      lat: stop.lat,
      lon: stop.lon,
      mode: "bus",
      code: toCode(appId),
      tfnswStopId: canonical,
    };
    stopRecords.set(appId, rec);
    return { appId, stop: rec };
  };
  const lineBranches = [];
  const lineStationIds = {};
  const seenBranch = new Set();

  for (const [key, trip_id] of repTripByRouteDir.entries()) {
    const [route_id, dir] = key.split("|");
    const route = busRoutes[route_id];
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

    const routeKey = route.short;
    const branchKey = `${routeKey}|${route.long}|${dir}|${stationIds.join(",")}`;
    if (seenBranch.has(branchKey)) continue;
    seenBranch.add(branchKey);

    const entry = {
      id: `${route_id}_${dir}`.replace(/[^A-Za-z0-9_]/g, "_"),
      route: routeKey,
      name: dir === "1" ? `${route.long || routeKey} (return)` : route.long || routeKey,
      color: route.color,
      stationIds,
      direction: dir === "1" ? "return" : "outbound",
    };
    lineBranches.push(entry);

    if (!lineStationIds[routeKey]) lineStationIds[routeKey] = [];
    for (const sid of stationIds) {
      if (!lineStationIds[routeKey].includes(sid)) lineStationIds[routeKey].push(sid);
    }
  }

  // Include every Sydney bbox stop as a pickable bus stop (even if not on a parsed branch)
  for (const gtfsId of Object.keys(stopsById)) {
    ensureAppStop(gtfsId);
  }

  const stops = [...stopRecords.values()].sort((a, b) => a.name.localeCompare(b.name));

  const busLines = Object.entries(lineStationIds)
    .map(([route, ids]) => {
      const branch = lineBranches.find((b) => b.route === route && b.direction === "outbound");
      const first = stops.find((s) => s.id === ids[0]);
      const last = stops.find((s) => s.id === ids[ids.length - 1]);
      return {
        route,
        name: branch?.name || `Route ${route}`,
        color: branch?.color || "#00B5E2",
        dests: [first?.name, last?.name].filter(Boolean),
        frequencyMins: 12,
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }));

  return {
    generatedAt: new Date().toISOString(),
    source: "tfnsw-gtfs-complete",
    stops,
    branches: lineBranches,
    lineStationIds,
    busLines,
    gtfsToAppId: gtfsToApp,
    stats: {
      stops: stops.length,
      branches: lineBranches.length,
      routes: Object.keys(lineStationIds).length,
    },
  };
}

function writeOutputs(payload) {
  const outDir = path.join(root, "src", "constants", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  // Routes only on frontend (stops are loaded via /api/stations — keeps app bundle small)
  const routesPayload = {
    generatedAt: payload.generatedAt,
    source: payload.source,
    branches: payload.branches,
    lineStationIds: payload.lineStationIds,
    busLines: payload.busLines,
    stats: payload.stats,
  };
  fs.writeFileSync(path.join(outDir, "busRoutes.json"), JSON.stringify(routesPayload));

  const backendPath = path.join(root, "backend", "data", "busNetworkData.js");
  const js = `/** Auto-generated — npm run sync:bus-network */
export const SYDNEY_BUS_STOPS = ${JSON.stringify(payload.stops)};

export const BUS_LINE_BRANCHES = ${JSON.stringify(payload.branches)};

export const BUS_LINE_STATION_IDS = ${JSON.stringify(payload.lineStationIds)};

export const SYDNEY_BUS_LINES = ${JSON.stringify(payload.busLines)};

export const BUS_GTFS_TO_APP_ID = ${JSON.stringify(payload.gtfsToAppId)};

export const BUS_STATION_BY_ID = Object.fromEntries(SYDNEY_BUS_STOPS.map((s) => [s.id, s]));

export function getBusLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of BUS_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_BUS_LINES.filter((line) => routes.has(line.route));
}
`;
  fs.writeFileSync(backendPath, js, "utf8");
  console.log("Stats:", payload.stats);
  console.log(`Wrote busRoutes.json + backend/data/busNetworkData.js`);
}

if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, "/")}` ||
    process.argv[1].toLowerCase().endsWith("sync-bus-network.mjs"))
) {
  const gtfsDir = await prepareGtfsDir();
  writeOutputs(await buildBusNetwork(gtfsDir));
}
