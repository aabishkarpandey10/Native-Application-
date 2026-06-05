/**
 * Sync non-train transit networks (metro, light rail, ferry, bus) from TfNSW GTFS Complete.
 *
 * Outputs:
 * - src/constants/generated/transitNetworks.json
 *
 * Run:
 *   node scripts/sync-transit-networks.mjs
 *
 * Requires:
 *   TFNSW_API_KEY in .env
 */
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}

const TFNSW_API_KEY = process.env.TFNSW_API_KEY?.trim();
const GTFS_COMPLETE_URL =
  "https://api.transport.nsw.gov.au/v1/publictransport/timetables/complete/gtfs";

function assertKey() {
  if (!TFNSW_API_KEY || TFNSW_API_KEY === "placeholder" || TFNSW_API_KEY.length < 6) {
    throw new Error("Missing TFNSW_API_KEY in .env");
  }
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

async function readCsv(filePath, onRow) {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    const vals = parseCsvLine(line);
    if (vals.length < headers.length) continue;
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = vals[i];
    onRow(row);
  }
}

function routeMode(route) {
  const short = String(route.route_short_name || "").trim().toUpperCase();
  const type = Number(route.route_type);

  // TfNSW: metro services are usually route_type=1 or show as "M1"
  if (short.startsWith("M")) return "metro";
  if (short.startsWith("L")) return "lightrail";
  if (short.startsWith("F")) return "ferry";
  if (/^\d{3,4}$/.test(short) || short.startsWith("B")) return "bus";

  // Fallback by GTFS route_type
  // TfNSW uses extended route_type values for some modes.
  if (type === 4) return "ferry";
  if (type === 700 || (type >= 700 && type < 800)) return "bus";
  if (type === 900 || (type >= 900 && type < 1000)) return "lightrail";
  if (type === 401 || type === 1) return "metro";

  return null;
}

function normalizeStopName(name) {
  return String(name || "")
    .replace(/\s+Station$/i, " Station")
    .replace(/\s+Light\s*Rail$/i, "")
    .trim();
}

function pickColor(mode, routeColor) {
  const c = String(routeColor || "").trim();
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c.toUpperCase()}`;
  if (mode === "metro") return "#0095A0";
  if (mode === "lightrail") return "#E62B1E";
  if (mode === "ferry") return "#52B848";
  return "#00B5E2"; // bus
}

async function downloadZip(outPath) {
  if (fs.existsSync(outPath)) {
    const existing = fs.statSync(outPath).size;
    if (existing > 10_000_000) {
      return;
    }
  }
  const res = await fetch(GTFS_COMPLETE_URL, {
    headers: { Authorization: `Apikey ${TFNSW_API_KEY}` },
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

function unzipToDir(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outDir, true);
}

export async function syncTransitNetworks() {
  assertKey();

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tfnsw-gtfs-"));
  console.log("Temp dir:", tmp);
  const cacheDir = path.join(root, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "tfnsw-gtfs-complete.zip");
  const gtfsDir = path.join(tmp, "gtfs");

  console.log("Downloading TfNSW GTFS Complete…");
  await downloadZip(zipPath);
  console.log("Extracting…");
  unzipToDir(zipPath, gtfsDir);

  const stopsPath = path.join(gtfsDir, "stops.txt");
  const routesPath = path.join(gtfsDir, "routes.txt");
  const tripsPath = path.join(gtfsDir, "trips.txt");
  const stopTimesPath = path.join(gtfsDir, "stop_times.txt");

  if (!fs.existsSync(stopsPath) || !fs.existsSync(routesPath) || !fs.existsSync(tripsPath) || !fs.existsSync(stopTimesPath)) {
    throw new Error("GTFS missing required files (stops/routes/trips/stop_times)");
  }

  console.log("Files:", {
    stops: fs.statSync(stopsPath).size,
    routes: fs.statSync(routesPath).size,
    trips: fs.statSync(tripsPath).size,
    stop_times: fs.statSync(stopTimesPath).size,
  });

  // 1) stops lookup (only keep parent stations / wharves + key hubs)
  const stopsById = {};
  const parentByStopId = {};
  await readCsv(stopsPath, (s) => {
    const id = String(s.stop_id || "").trim();
    if (!id) return;
    const locType = Number(s.location_type || 0);
    const parent = String(s.parent_station || "").trim();
    if (parent) parentByStopId[id] = parent;
    const nameLower = String(s.stop_name || "").toLowerCase();
    const isWharf = nameLower.includes("wharf") || nameLower.includes("ferry terminal");
    const isHub = locType === 1 || !s.parent_station || isWharf;
    if (!isHub) return;
    const lat = Number(s.stop_lat || 0);
    const lon = Number(s.stop_lon || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    stopsById[id] = {
      id,
      name: normalizeStopName(s.stop_name),
      lat,
      lon,
    };
  });

  // 2) routes by mode
  const routes = {};
  await readCsv(routesPath, (r) => {
    const id = String(r.route_id || "").trim();
    if (!id) return;
    const mode = routeMode(r);
    if (!mode) return;
    const short = String(r.route_short_name || "").trim() || id;
    routes[id] = {
      route_id: id,
      short,
      long: String(r.route_long_name || "").trim(),
      mode,
      color: pickColor(mode, r.route_color),
    };
  });
  console.log("Parsed routes:", Object.keys(routes).length);

  // 3) pick representative trip per route+direction (prefer non-empty headsign)
  const repTripByRouteDir = new Map(); // key: `${route_id}|${dir}` => trip_id
  const routeTripCounts = new Map(); // used to pick bus top-N if needed
  await readCsv(tripsPath, (t) => {
    const route_id = String(t.route_id || "").trim();
    const trip_id = String(t.trip_id || "").trim();
    if (!route_id || !trip_id) return;
    const route = routes[route_id];
    if (!route) return;

    routeTripCounts.set(route_id, (routeTripCounts.get(route_id) || 0) + 1);
    const dir = String(t.direction_id ?? "0").trim() || "0";
    const key = `${route_id}|${dir}`;
    if (!repTripByRouteDir.has(key)) repTripByRouteDir.set(key, trip_id);
  });
  console.log("Representative route-directions:", repTripByRouteDir.size);

  // 4) Limit buses: keep top 60 bus routes by trip count (keeps output usable)
  const busRouteIds = Object.values(routes)
    .filter((r) => r.mode === "bus")
    .map((r) => r.route_id)
    .sort((a, b) => (routeTripCounts.get(b) || 0) - (routeTripCounts.get(a) || 0));
  const allowBus = new Set(busRouteIds.slice(0, 60));

  const wantedTripIds = new Set();
  for (const [key, trip_id] of repTripByRouteDir.entries()) {
    const [route_id] = key.split("|");
    const route = routes[route_id];
    if (!route) continue;
    if (route.mode === "bus" && !allowBus.has(route_id)) continue;
    wantedTripIds.add(trip_id);
  }
  console.log("Wanted trips:", wantedTripIds.size);

  // 5) Build stop sequences for representative trips
  const seqByTrip = new Map(); // trip_id => [{stop_id, stop_sequence}]
  await readCsv(stopTimesPath, (st) => {
    const trip_id = String(st.trip_id || "").trim();
    if (!wantedTripIds.has(trip_id)) return;
    const stop_id = String(st.stop_id || "").trim();
    if (!stop_id) return;
    const stop_sequence = Number(st.stop_sequence || 0);
    if (!seqByTrip.has(trip_id)) seqByTrip.set(trip_id, []);
    seqByTrip.get(trip_id).push({ stop_id, stop_sequence });
  });
  console.log("Trips with stop sequences:", seqByTrip.size);

  // 6) Build branches grouped by mode
  const sections = {
    metro: [],
    lightrail: [],
    ferry: [],
    bus: [],
  };

  for (const [key, trip_id] of repTripByRouteDir.entries()) {
    const [route_id, dir] = key.split("|");
    const route = routes[route_id];
    if (!route) continue;
    if (route.mode === "bus" && !allowBus.has(route_id)) continue;
    const seq = (seqByTrip.get(trip_id) || [])
      .sort((a, b) => a.stop_sequence - b.stop_sequence)
      .map((x) => parentByStopId[x.stop_id] || x.stop_id)
      .filter(Boolean);

    // Filter to stops we can name; also dedupe adjacent duplicates
    const stationIds = [];
    for (const s of seq) {
      if (!stopsById[s]) continue;
      if (stationIds[stationIds.length - 1] === s) continue;
      stationIds.push(s);
    }
    if (stationIds.length < 3) continue;

    const id = `${route.route_id}_${dir}`.replace(/[^A-Za-z0-9_]/g, "_");
    const nameBase = route.long || route.short;
    const name = dir === "1" ? `${nameBase} (return)` : nameBase;

    sections[route.mode].push({
      id,
      route: route.short,
      name,
      color: route.color,
      stationIds,
    });
  }

  // deterministic ordering
  for (const k of Object.keys(sections)) {
    sections[k].sort((a, b) => (a.route + a.name).localeCompare(b.route + b.name));
  }

  const outDir = path.join(root, "src", "constants", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "transitNetworks.json");

  // Only keep stops referenced by branches (keeps asset smaller)
  const usedStops = new Set();
  for (const mode of Object.keys(sections)) {
    for (const br of sections[mode]) for (const sid of br.stationIds) usedStops.add(sid);
  }
  const compactStops = {};
  for (const sid of usedStops) compactStops[sid] = stopsById[sid];

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "tfnsw-gtfs-complete",
    modes: {
      metro: { label: "Metro", branches: sections.metro },
      lightrail: { label: "Light rail", branches: sections.lightrail },
      ferry: { label: "Ferries", branches: sections.ferry },
      bus: { label: "Buses", branches: sections.bus },
    },
    stopsById: compactStops,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Wrote transitNetworks.json: metro=${sections.metro.length}, lightRail=${sections.lightrail.length}, ferry=${sections.ferry.length}, bus=${sections.bus.length}, stops=${Object.keys(compactStops).length}`
  );
}

if (
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, "/")}` ||
    process.argv[1].toLowerCase().endsWith("sync-transit-networks.mjs"))
) {
  syncTransitNetworks().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

