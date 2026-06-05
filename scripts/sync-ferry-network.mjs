/**
 * Build Sydney ferry wharfs + route stop sequences from TfNSW GTFS (transitNetworks.json).
 *
 * Run after sync-transit-networks (or uses existing generated file):
 *   node scripts/sync-transit-networks.mjs
 *   node scripts/sync-ferry-network.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const transitPath = path.join(root, "src", "constants", "generated", "transitNetworks.json");

function normalizeWharfName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .replace(/\s+Wharf$/i, " Wharf")
    .trim();
}

function toAppId(name, used) {
  const base = String(name || "WHARF")
    .replace(/\s+Wharf$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 28) || "WHARF";
  let id = `${base}_F`;
  let n = 2;
  while (used.has(id)) {
    id = `${base}${n}_F`;
    n += 1;
  }
  used.add(id);
  return id;
}

function toCode(appId) {
  return appId.replace(/_F$/, "").slice(0, 6);
}

function displayRoute(route) {
  const m = String(route || "").match(/^(F\d+)/i);
  return m ? m[1].toUpperCase() : String(route || "").toUpperCase();
}

function loadTransit() {
  if (!fs.existsSync(transitPath)) {
    throw new Error(
      `Missing ${transitPath}. Run: node scripts/sync-transit-networks.mjs (requires TFNSW_API_KEY)`
    );
  }
  return JSON.parse(fs.readFileSync(transitPath, "utf8"));
}

export function buildFerryNetwork(transit) {
  const stopsById = transit.stopsById || {};
  const branches = transit.modes?.ferry?.branches || [];
  const usedAppIds = new Set();
  const gtfsToApp = {};

  const wharfs = [];
  for (const [gtfsId, stop] of Object.entries(stopsById)) {
    const name = normalizeWharfName(stop.name);
    if (!/wharf|ferry terminal|circular quay/i.test(name) && !branches.some((b) => b.stationIds?.includes(gtfsId))) {
      continue;
    }
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) continue;
    const appId = toAppId(name, usedAppIds);
    gtfsToApp[gtfsId] = appId;
    wharfs.push({
      id: appId,
      name,
      lat: stop.lat,
      lon: stop.lon,
      mode: "ferry",
      code: toCode(appId),
      tfnswStopId: gtfsId,
    });
  }

  // Ensure every stop referenced on a ferry route is included
  for (const branch of branches) {
    for (const gtfsId of branch.stationIds || []) {
      if (gtfsToApp[gtfsId]) continue;
      const stop = stopsById[gtfsId];
      if (!stop) continue;
      const name = normalizeWharfName(stop.name);
      const appId = toAppId(name, usedAppIds);
      gtfsToApp[gtfsId] = appId;
      wharfs.push({
        id: appId,
        name,
        lat: stop.lat,
        lon: stop.lon,
        mode: "ferry",
        code: toCode(appId),
        tfnswStopId: gtfsId,
      });
    }
  }

  wharfs.sort((a, b) => a.name.localeCompare(b.name));

  const lineBranches = [];
  const lineStationIds = {};
  const seenBranch = new Set();

  for (const branch of branches) {
    const stationIds = (branch.stationIds || [])
      .map((gid) => gtfsToApp[gid])
      .filter(Boolean);
    if (stationIds.length < 2) continue;

    const route = displayRoute(branch.route);
    const key = `${route}|${branch.name}|${stationIds.join(",")}`;
    if (seenBranch.has(key)) continue;
    seenBranch.add(key);

    const entry = {
      id: branch.id.replace(/[^A-Za-z0-9_]/g, "_"),
      route,
      name: branch.name.replace(/\s+\(return\)$/i, "").trim(),
      color: branch.color || "#52B848",
      stationIds,
      direction: /\(return\)/i.test(branch.name) ? "return" : "outbound",
    };
    lineBranches.push(entry);

    if (!lineStationIds[route]) lineStationIds[route] = [];
    for (const sid of stationIds) {
      if (!lineStationIds[route].includes(sid)) lineStationIds[route].push(sid);
    }
  }

  const ferryLines = Object.entries(lineStationIds)
    .filter(([route]) => /^F\d+$/i.test(route))
    .map(([route, ids]) => {
      const branch = lineBranches.find((b) => b.route === route && b.direction === "outbound");
      const terminals = [
        wharfs.find((w) => w.id === ids[0])?.name?.replace(/\s+Wharf$/i, ""),
        wharfs.find((w) => w.id === ids[ids.length - 1])?.name?.replace(/\s+Wharf$/i, ""),
      ].filter(Boolean);
      return {
        route,
        name: branch?.name || `${route} Ferry`,
        color: branch?.color || "#52B848",
        dests: [...new Set(terminals)],
        frequencyMins: 20,
      };
    })
    .sort((a, b) => a.route.localeCompare(b.route));

  return {
    generatedAt: new Date().toISOString(),
    source: transit.source || "tfnsw-gtfs-complete",
    wharfs,
    branches: lineBranches,
    lineStationIds,
    ferryLines,
    gtfsToAppId: gtfsToApp,
  };
}

function writeOutputs(payload) {
  const outDir = path.join(root, "src", "constants", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "ferryNetwork.json"), JSON.stringify(payload, null, 2));

  const backendPath = path.join(root, "backend", "data", "ferryNetworkData.js");
  const js = `/** Auto-generated — node scripts/sync-ferry-network.mjs */
export const SYDNEY_FERRY_WHARFS = ${JSON.stringify(payload.wharfs, null, 2)};

export const FERRY_LINE_BRANCHES = ${JSON.stringify(payload.branches, null, 2)};

export const FERRY_LINE_STATION_IDS = ${JSON.stringify(payload.lineStationIds, null, 2)};

export const SYDNEY_FERRY_LINES = ${JSON.stringify(payload.ferryLines, null, 2)};

export const FERRY_GTFS_TO_APP_ID = ${JSON.stringify(payload.gtfsToAppId, null, 2)};

export const FERRY_STATION_BY_ID = Object.fromEntries(
  SYDNEY_FERRY_WHARFS.map((s) => [s.id, s])
);

export function getFerryLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of FERRY_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_FERRY_LINES.filter((line) => routes.has(line.route));
}
`;
  fs.writeFileSync(backendPath, js, "utf8");
  console.log(
    `Wrote ${payload.wharfs.length} wharfs, ${payload.branches.length} branches, ${payload.ferryLines.length} F-routes`
  );
}

if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, "/")}` ||
    process.argv[1].toLowerCase().endsWith("sync-ferry-network.mjs"))
) {
  const transit = loadTransit();
  writeOutputs(buildFerryNetwork(transit));
}
