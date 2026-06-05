/**
 * Build Sydney M1 Metro stops + branch sequences from TfNSW GTFS Complete.
 *
 *   npm run sync:metro-network
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

const METRO_ROUTES = new Set(["M1"]);

/** Preserve app + timetable IDs from the original hand-maintained network. */
const LEGACY_METRO_BY_NORM = {
  tallawong: "TALLAWONG_M",
  rousehill: "ROUSEHILL_M",
  kellyville: "KELLYVILLE_M",
  bellavista: "BELLAVISTA_M",
  norwest: "NORWEST_M",
  castlehill: "CASTLEHILL_M",
  showground: "SHOWGROUND_M",
  cherrybrook: "CHERRYBROOK_M",
  epping: "EPPING_M",
  macquarieuniversity: "MACQUARIE_M",
  macquariepark: "MACQUARIEPARK_M",
  northryde: "NORTHRYDE_M",
  chatswood: "CHATSWOOD_M",
  chatswoodmetro: "CHATSWOOD_M",
  crowsnest: "CROWSNEST_M",
  victoriacross: "VICTORIACROSS_M",
  barangaroo: "BARANGAROO_M",
  martinplace: "MARTINPLACE_M",
  gadigal: "GADIGAL_M",
  central: "CENTRAL_M",
  centralmetro: "CENTRAL_M",
  waterloo: "WATERLOO_M",
  sydenham: "SYDENHAM_M",
  sydenhammetro: "SYDENHAM_M",
  campsie: "CAMPSIE_M",
  canterbury: "CANTERBURY_M",
  belmore: "BELMORE_M",
  lakemba: "LAKEMBA_M",
  wileypark: "WILEYPARK_M",
  punchbowl: "PUNCHBOWL_M",
  bankstown: "BANKSTOWN_M",
  campsie: "CAMPSIE_M",
  campsiemetro: "CAMPSIE_M",
  canterbury: "CANTERBURY_M",
  canterburymetro: "CANTERBURY_M",
  belmore: "BELMORE_M",
  belmoremetro: "BELMORE_M",
  lakemba: "LAKEMBA_M",
  lakembametro: "LAKEMBA_M",
  wileypark: "WILEYPARK_M",
  punchbowl: "PUNCHBOWL_M",
};

/** Southwest extension (Sydenham → Bankstown) — supplement when GTFS trips end at Sydenham. */
const M1_SOUTHWEST_EXTENSION = [
  { id: "CAMPSIE_M", name: "Campsie Metro Station", lat: -33.91043503, lon: 151.10345755, code: "CAMPSI", tfnswStopId: "219410" },
  { id: "CANTERBURY_M", name: "Canterbury Metro Station", lat: -33.9142, lon: 151.1188, code: "CANTER" },
  { id: "BELMORE_M", name: "Belmore Metro Station", lat: -33.9177, lon: 151.0885, code: "BELMOR" },
  { id: "LAKEMBA_M", name: "Lakemba Metro Station", lat: -33.9202, lon: 151.077, code: "LAKEMB" },
  { id: "WILEYPARK_M", name: "Wiley Park Metro Station", lat: -33.9238, lon: 151.0685, code: "WILEYP" },
  { id: "PUNCHBOWL_M", name: "Punchbowl Metro Station", lat: -33.9282, lon: 151.0512, code: "PUNCHB" },
  { id: "BANKSTOWN_M", name: "Bankstown Metro Station", lat: -33.91784784, lon: 151.03465392, code: "BANKST", tfnswStopId: "220010" },
];

function applyBankstownExtension(stopRecords, lineBranches, lineStationIds, gtfsToApp) {
  const extensionIds = M1_SOUTHWEST_EXTENSION.map((s) => s.id);
  if (extensionIds.every((id) => stopRecords.has(id))) return;

  for (const stop of M1_SOUTHWEST_EXTENSION) {
    if (!stopRecords.has(stop.id)) {
      stopRecords.set(stop.id, { ...stop, mode: "metro" });
    }
    if (stop.tfnswStopId) gtfsToApp[stop.tfnswStopId] = stop.id;
  }

  const returnBranch = lineBranches.find((b) => b.route === "M1" && b.direction === "return");
  const outboundBranch = lineBranches.find((b) => b.route === "M1" && b.direction === "outbound");
  if (!returnBranch || !outboundBranch) return;

  const hasExtension = returnBranch.stationIds.includes("BANKSTOWN_M");
  if (hasExtension) return;

  const sydIdx = returnBranch.stationIds.indexOf("SYDENHAM_M");
  if (sydIdx === -1) return;

  returnBranch.stationIds = [
    ...returnBranch.stationIds.slice(0, sydIdx + 1),
    ...extensionIds,
  ];
  outboundBranch.stationIds = [...returnBranch.stationIds].reverse();

  lineStationIds.M1 = [...returnBranch.stationIds];
}

function normKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/,\s*sydney.*$/i, "")
    .replace(/\s+metro(\s+station)?$/i, "")
    .replace(/\s+station$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function displayStopName(name, appId) {
  const legacyLabels = {
    CHATSWOOD_M: "Chatswood Metro Station",
    EPPING_M: "Epping Metro",
    SYDENHAM_M: "Sydenham Metro",
    CENTRAL_M: "Central Metro Station",
    GADIGAL_M: "Gadigal Station",
    BARANGAROO_M: "Barangaroo Station",
  };
  if (legacyLabels[appId]) return legacyLabels[appId];
  const base = String(name || "")
    .replace(/,\s*Sydney.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/metro/i.test(base) || /station$/i.test(base)) return base;
  return `${base} Station`;
}

function resolveLegacyId(name) {
  const key = normKey(name);
  if (LEGACY_METRO_BY_NORM[key]) return LEGACY_METRO_BY_NORM[key];
  const compact = key.replace(/\s+/g, "");
  if (LEGACY_METRO_BY_NORM[compact]) return LEGACY_METRO_BY_NORM[compact];
  for (const [legacyKey, id] of Object.entries(LEGACY_METRO_BY_NORM)) {
    if (key.includes(legacyKey) || legacyKey.includes(key)) return id;
  }
  return null;
}

function toAppId(name, used) {
  const legacy = resolveLegacyId(name);
  if (legacy) {
    used.add(legacy);
    return legacy;
  }
  const base =
    String(name || "STOP")
      .replace(/,\s*[^,]+$/i, "")
      .replace(/[^A-Za-z0-9]+/g, "")
      .toUpperCase()
      .slice(0, 28) || "STOP";
  let id = `${base}_M`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}${n}_M`;
    n += 1;
  }
  used.add(id);
  return id;
}

function toCode(appId) {
  return appId.replace(/_M$/, "").slice(0, 6);
}

function resolveStopId(rawId, stopsById, parentByStopId) {
  const parent = parentByStopId[rawId];
  if (parent && stopsById[parent]) return parent;
  return rawId;
}

function displayRoute(short) {
  const m = String(short || "").match(/^(M\d+)/i);
  return m ? m[1].toUpperCase() : String(short || "").toUpperCase();
}

export async function buildMetroNetwork(gtfsDir) {
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
    if (!inGreaterSydney(lat, lon)) return;
    const parent = String(s.parent_station || "").trim();
    if (parent) parentByStopId[id] = parent;
    const name = String(s.stop_name || "").trim();
    if (!name) return;
    stopsById[id] = { id, name, lat, lon };
  });

  const metroRoutes = {};
  await readCsv(routesPath, (r) => {
    const id = String(r.route_id || "").trim();
    if (!id) return;
    const mode = routeMode(r);
    if (mode !== "metro") return;
    const short = displayRoute(r.route_short_name || r.route_id);
    if (!METRO_ROUTES.has(short)) return;
    metroRoutes[id] = {
      route_id: id,
      short,
      long: String(r.route_long_name || "").trim(),
      color: pickRouteColor("metro", r.route_color),
    };
  });
  console.log("Metro routes (M1):", Object.keys(metroRoutes).length);

  const repTripByRouteDir = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    if (!metroRoutes[route_id]) return;
    const trip_id = String(t.trip_id || "").trim();
    if (!trip_id) return;
    const dir = String(t.direction_id ?? "0").trim() || "0";
    const key = `${route_id}|${dir}`;
    if (!repTripByRouteDir.has(key)) repTripByRouteDir.set(key, trip_id);
  });

  const wantedTripIds = new Set(repTripByRouteDir.values());
  const seqByTrip = new Map();
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
      name: displayStopName(stop.name, appId),
      lat: stop.lat,
      lon: stop.lon,
      mode: "metro",
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
    const route = metroRoutes[route_id];
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
    const branchKey = `${routeKey}|${dir}|${stationIds.join(",")}`;
    if (seenBranch.has(branchKey)) continue;
    seenBranch.add(branchKey);

    const outboundName =
      route.long || "M1 Metro North West & Bankstown Line";

    lineBranches.push({
      id: `metro_${routeKey}_${dir}`.replace(/[^A-Za-z0-9_]/g, "_"),
      route: routeKey,
      name: dir === "1" ? `${outboundName} (return)` : outboundName,
      color: route.color,
      stationIds,
      direction: dir === "1" ? "return" : "outbound",
    });

    if (!lineStationIds[routeKey]) lineStationIds[routeKey] = [];
    for (const sid of stationIds) {
      if (!lineStationIds[routeKey].includes(sid)) lineStationIds[routeKey].push(sid);
    }
  }

  for (const routeKey of METRO_ROUTES) {
    const outbound = lineBranches.find(
      (b) => b.route === routeKey && b.direction === "outbound"
    );
    if (outbound?.stationIds?.length) lineStationIds[routeKey] = [...outbound.stationIds];
  }

  // Map platform / child stop_ids to the same app station (stop_times use platform IDs).
  for (const [stopId, parent] of Object.entries(parentByStopId)) {
    const resolved = resolveStopId(stopId, stopsById, parentByStopId);
    const appId = gtfsToApp[resolved] || gtfsToApp[parent];
    if (appId) {
      gtfsToApp[stopId] = appId;
      if (parent) gtfsToApp[parent] = appId;
    }
  }

  applyBankstownExtension(stopRecords, lineBranches, lineStationIds, gtfsToApp);

  const stops = [...stopRecords.values()].sort((a, b) => a.name.localeCompare(b.name));

  const metroLines = [...METRO_ROUTES].map((routeKey) => {
    const branch = lineBranches.find((b) => b.route === routeKey && b.direction === "outbound");
    const ids = lineStationIds[routeKey] || [];
    const first = stops.find((s) => s.id === ids[0]);
    const last = stops.find((s) => s.id === ids[ids.length - 1]);
    const strip = (n) =>
      String(n || "")
        .replace(/\s+Station$/i, "")
        .replace(/\s+Metro$/i, "")
        .trim();
    const fullIds = lineStationIds[routeKey] || ids;
    const endNorth = stops.find((s) => s.id === fullIds[0]);
    const endSouth = stops.find((s) => s.id === fullIds[fullIds.length - 1]);
    return {
      route: routeKey,
      name: "M1 Metro North West & Bankstown Line",
      color: branch?.color || "#0095A0",
      dests: [strip(endNorth?.name), strip(endSouth?.name)].filter(Boolean),
      frequencyMins: 5,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "tfnsw-gtfs-complete",
    stops,
    branches: lineBranches,
    lineStationIds,
    metroLines,
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
  fs.writeFileSync(path.join(outDir, "metroNetwork.json"), JSON.stringify(payload, null, 0));

  const backendPath = path.join(root, "backend", "data", "metroNetworkData.js");
  const js = `/** Auto-generated — npm run sync:metro-network */
export const SYDNEY_METRO_STATIONS = ${JSON.stringify(payload.stops)};

export const METRO_LINE_BRANCHES = ${JSON.stringify(payload.branches)};

export const METRO_LINE_STATION_IDS = ${JSON.stringify(payload.lineStationIds)};

export const SYDNEY_METRO_LINES = ${JSON.stringify(payload.metroLines)};

export const METRO_GTFS_TO_APP_ID = ${JSON.stringify(payload.gtfsToAppId)};

export const METRO_STATION_BY_ID = Object.fromEntries(
  SYDNEY_METRO_STATIONS.map((s) => [s.id, s])
);

export function getMetroLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of METRO_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_METRO_LINES.filter((line) => routes.has(line.route));
}
`;
  fs.writeFileSync(backendPath, js, "utf8");
  console.log("Stats:", payload.stats);
  console.log(`Wrote metroNetwork.json + backend/data/metroNetworkData.js`);
}

if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` ||
    process.argv[1].toLowerCase().endsWith("sync-metro-network.mjs"))
) {
  const gtfsDir = await prepareGtfsDir();
  writeOutputs(await buildMetroNetwork(gtfsDir));
}
