/**
 * Build Sydney L1/L2/L3 light rail stops + branch sequences from TfNSW GTFS Complete.
 *
 *   npm run sync:light-rail-network
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

const LR_ROUTES = new Set(["L1", "L2", "L3"]);

/** Preserve timetable + app IDs from the original hand-maintained network. */
const LEGACY_LR_BY_NORM = {
  circularquay: "CIRCULARQUAY_LR",
  bridgestreet: "BRIDGESTREET_LR",
  wynyard: "WYNYARD_LR",
  qvb: "QVB_LR",
  queenvictoriabuilding: "QVB_LR",
  townhall: "TOWNHALL_LR",
  chinatown: "CHINATOWN_LR",
  haymarket: "HAYMARKET_LR",
  central: "CENTRAL_LR",
  centralchalmersstreet: "CENTRAL_LR",
  surryhills: "SURRYHILLS_LR",
  moorepark: "MOOREPARK_LR",
  royalrandwick: "ROYALRANDWICK_LR",
  wanseyroad: "WANSEYROAD_LR",
  unswhighstreet: "UNSWHIGHSTREET_LR",
  randwick: "RANDWICK_LR",
  esmarks: "ESMARKS_LR",
  kensington: "KENSINGTON_LR",
  unswanzacparade: "UNSWANZAC_LR",
  kingsford: "KINGSFORD_LR",
  juniorskingsford: "JUNIORSKINGSFORD_LR",
  exhibitioncentre: "EXHIBITION_LR",
  convention: "CONVENTION_LR",
  pyrmontbay: "PYRMONTBAY_LR",
  thestar: "THESTAR_LR",
  johnstreetsquare: "JOHNSTREET_LR",
  fishmarket: "FISHMARKET_LR",
  wentworthpark: "WENTWORTHPARK_LR",
  rozellebay: "ROZELLEBAY_LR",
  jubileepark: "JUBILEEPARK_LR",
  glebe: "GLEBE_LR",
  lilyfield: "LILYFIELD_LR",
  leichhardtnorth: "LEICHHARDTNORTH_LR",
  hawthorne: "HAWTHORNE_LR",
  marion: "MARION_LR",
  tavernershill: "TAVERNERSHILL_LR",
  lewishamwest: "LEWISHAMWEST_LR",
  waratahmills: "WARATAHMILLS_LR",
  arlington: "ARLINGTON_LR",
  dulwichgrove: "DULWICHGROVE_LR",
  dulwichhill: "DULWICHHILL_LR",
  // GTFS stop name variants
  centralstation: "CENTRAL_LR",
  townhallstation: "TOWNHALL_LR",
  wynyardstation: "WYNYARD_LR",
  bridgestreetlightrail: "BRIDGESTREET_LR",
  dulwichhillstation: "DULWICHHILL_LR",
  exhibitioncentrelighrail: "EXHIBITION_LR",
  pyrmontbaylightrail: "PYRMONTBAY_LR",
  thestarlightrail: "THESTAR_LR",
  johnstreetsquarelightrail: "JOHNSTREET_LR",
  wentworthparklightrail: "WENTWORTHPARK_LR",
  jubileeparklightrail: "JUBILEEPARK_LR",
  rozellebaylightrail: "ROZELLEBAY_LR",
  leichhardtnorthlightrail: "LEICHHARDTNORTH_LR",
  lewishamwestlightrail: "LEWISHAMWEST_LR",
  tavernershilllightrail: "TAVERNERSHILL_LR",
  waratahmillslightrail: "WARATAHMILLS_LR",
  dulwichgrovelightrail: "DULWICHGROVE_LR",
  esmarkslightrail: "ESMARKS_LR",
  mooreparklightrail: "MOOREPARK_LR",
  royalrandwicklightrail: "ROYALRANDWICK_LR",
  wanseyroadlightrail: "WANSEYROAD_LR",
  unswhighstreetlightrail: "UNSWHIGHSTREET_LR",
  unswanzacparadelightrail: "UNSWANZAC_LR",
  juniorskingsfordlightrail: "JUNIORSKINGSFORD_LR",
  surryhillslightrail: "SURRYHILLS_LR",
};

function normKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/,\s*sydney.*$/i, "")
    .replace(/\s+light\s*rail(\s+stop)?$/i, "")
    .replace(/\s+stop$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function displayStopName(name, appId) {
  const legacyLabels = {
    CENTRAL_LR: "Central Light Rail stop",
    CIRCULARQUAY_LR: "Circular Quay Light Rail stop",
    TOWNHALL_LR: "Town Hall Light Rail stop",
    WYNYARD_LR: "Wynyard Light Rail stop",
    BRIDGESTREET_LR: "Bridge Street Light Rail stop",
    QVB_LR: "QVB Light Rail stop",
    DULWICHHILL_LR: "Dulwich Hill Light Rail stop",
  };
  if (legacyLabels[appId]) return legacyLabels[appId];
  const base = String(name || "")
    .replace(/,\s*Sydney.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/light\s*rail/i.test(base)) return base;
  return `${base} Light Rail stop`;
}

function resolveLegacyId(name) {
  const key = normKey(name);
  if (LEGACY_LR_BY_NORM[key]) return LEGACY_LR_BY_NORM[key];
  const compact = key.replace(/\s+/g, "");
  if (LEGACY_LR_BY_NORM[compact]) return LEGACY_LR_BY_NORM[compact];
  for (const [legacyKey, id] of Object.entries(LEGACY_LR_BY_NORM)) {
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
  let id = `${base}_LR`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}${n}_LR`;
    n += 1;
  }
  used.add(id);
  return id;
}

function toCode(appId) {
  return appId.replace(/_LR$/, "").slice(0, 6);
}

function resolveStopId(rawId, stopsById, parentByStopId) {
  const parent = parentByStopId[rawId];
  if (parent && stopsById[parent]) return parent;
  return rawId;
}

function displayRoute(short) {
  const m = String(short || "").match(/^(L\d+)/i);
  return m ? m[1].toUpperCase() : String(short || "").toUpperCase();
}

export async function buildLightRailNetwork(gtfsDir) {
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

  const lrRoutes = {};
  await readCsv(routesPath, (r) => {
    const id = String(r.route_id || "").trim();
    if (!id) return;
    const mode = routeMode(r);
    if (mode !== "lightrail") return;
    const short = displayRoute(r.route_short_name || r.route_id);
    if (!LR_ROUTES.has(short)) return;
    lrRoutes[id] = {
      route_id: id,
      short,
      long: String(r.route_long_name || "").trim(),
      color: pickRouteColor("lightrail", r.route_color),
    };
  });
  console.log("Light rail routes (L1–L3):", Object.keys(lrRoutes).length);

  const repTripByRouteDir = new Map();
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    if (!lrRoutes[route_id]) return;
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
      mode: "lightrail",
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
    const route = lrRoutes[route_id];
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
      route.long ||
      (routeKey === "L1"
        ? "L1 Dulwich Hill Line"
        : routeKey === "L2"
          ? "L2 Randwick Line"
          : "L3 Kingsford Line");

    lineBranches.push({
      id: `lr_${routeKey}_${dir}`.replace(/[^A-Za-z0-9_]/g, "_"),
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

  // Prefer outbound branch order for lineStationIds
  for (const routeKey of LR_ROUTES) {
    const outbound = lineBranches.find(
      (b) => b.route === routeKey && b.direction === "outbound"
    );
    if (outbound?.stationIds?.length) lineStationIds[routeKey] = [...outbound.stationIds];
  }

  const stops = [...stopRecords.values()].sort((a, b) => a.name.localeCompare(b.name));

  const lightRailLines = [...LR_ROUTES].map((routeKey) => {
    const branch = lineBranches.find((b) => b.route === routeKey && b.direction === "outbound");
    const ids = lineStationIds[routeKey] || [];
    const first = stops.find((s) => s.id === ids[0]);
    const last = stops.find((s) => s.id === ids[ids.length - 1]);
    const strip = (n) =>
      String(n || "")
        .replace(/\s+Light Rail stop$/i, "")
        .trim();
    return {
      route: routeKey,
      name:
        routeKey === "L1"
          ? "L1 Dulwich Hill Line"
          : routeKey === "L2"
            ? "L2 Randwick Line"
            : "L3 Kingsford Line",
      color: branch?.color || "#E62B1E",
      dests: [strip(first?.name), strip(last?.name)].filter(Boolean),
      frequencyMins: 8,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "tfnsw-gtfs-complete",
    stops,
    branches: lineBranches,
    lineStationIds,
    lightRailLines,
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
  fs.writeFileSync(path.join(outDir, "lightRailNetwork.json"), JSON.stringify(payload, null, 0));

  const backendPath = path.join(root, "backend", "data", "lightRailNetworkData.js");
  const js = `/** Auto-generated — npm run sync:light-rail-network */
export const SYDNEY_LIGHT_RAIL_STOPS = ${JSON.stringify(payload.stops)};

export const LIGHT_RAIL_LINE_BRANCHES = ${JSON.stringify(payload.branches)};

export const LIGHT_RAIL_LINE_STATION_IDS = ${JSON.stringify(payload.lineStationIds)};

export const SYDNEY_LIGHT_RAIL_LINES = ${JSON.stringify(payload.lightRailLines)};

export const LIGHT_RAIL_GTFS_TO_APP_ID = ${JSON.stringify(payload.gtfsToAppId)};

export const LIGHT_RAIL_STATION_BY_ID = Object.fromEntries(
  SYDNEY_LIGHT_RAIL_STOPS.map((s) => [s.id, s])
);

export function getLightRailLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of LIGHT_RAIL_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_LIGHT_RAIL_LINES.filter((line) => routes.has(line.route));
}
`;
  fs.writeFileSync(backendPath, js, "utf8");
  console.log("Stats:", payload.stats);
  console.log(`Wrote lightRailNetwork.json + backend/data/lightRailNetworkData.js`);
}

if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` ||
    process.argv[1].toLowerCase().endsWith("sync-light-rail-network.mjs"))
) {
  const gtfsDir = await prepareGtfsDir();
  writeOutputs(await buildLightRailNetwork(gtfsDir));
}
