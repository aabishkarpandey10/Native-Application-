/** Shared TfNSW GTFS Complete helpers for sync scripts. */
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
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

export const GTFS_COMPLETE_URL =
  "https://api.transport.nsw.gov.au/v1/publictransport/timetables/complete/gtfs";

export const GREATER_SYDNEY_BBOX = {
  minLat: -34.25,
  maxLat: -33.42,
  minLon: 150.52,
  maxLon: 151.45,
};

export function inGreaterSydney(lat, lon) {
  return (
    lat >= GREATER_SYDNEY_BBOX.minLat &&
    lat <= GREATER_SYDNEY_BBOX.maxLat &&
    lon >= GREATER_SYDNEY_BBOX.minLon &&
    lon <= GREATER_SYDNEY_BBOX.maxLon
  );
}

export function assertTfnswKey() {
  const key = process.env.TFNSW_API_KEY?.trim();
  if (!key || key === "placeholder" || key.length < 6) {
    throw new Error("Missing TFNSW_API_KEY in .env");
  }
  return key;
}

export function parseCsvLine(line) {
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

export async function readCsv(filePath, onRow) {
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

export function routeMode(route) {
  const short = String(route.route_short_name || "").trim().toUpperCase();
  const type = Number(route.route_type);

  if (short.startsWith("M") && /^M\d/.test(short)) return "metro";
  if (short.startsWith("L") && /^L\d/.test(short)) return "lightrail";
  if (short.startsWith("F") && /^F\d/.test(short)) return "ferry";
  if (/^\d{1,4}[A-Z]?$/.test(short) || /^B\d/.test(short)) return "bus";

  if (type === 4) return "ferry";
  if (type === 3 || (type >= 700 && type < 800)) return "bus";
  if (type === 900 || (type >= 900 && type < 1000)) return "lightrail";
  if (type === 401 || type === 1) return "metro";

  return null;
}

export function pickRouteColor(mode, routeColor) {
  const c = String(routeColor || "").trim();
  if (/^[0-9A-Fa-f]{6}$/.test(c)) return `#${c.toUpperCase()}`;
  if (mode === "metro") return "#0095A0";
  if (mode === "lightrail") return "#E62B1E";
  if (mode === "ferry") return "#52B848";
  return "#00B5E2";
}

async function downloadZip(apiKey, outPath) {
  if (fs.existsSync(outPath)) {
    const existing = fs.statSync(outPath).size;
    if (existing > 10_000_000) return;
  }
  const res = await fetch(GTFS_COMPLETE_URL, {
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/octet-stream" },
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
}

function unzipToDir(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outDir, true);
}

/** Use cached extract only (no API key required). */
export function prepareGtfsDirFromCache() {
  const extractRoot = path.join(root, ".cache", "gtfs-extract");
  const gtfsDir = path.join(extractRoot, "gtfs");
  if (!fs.existsSync(path.join(gtfsDir, "stops.txt"))) {
    throw new Error("GTFS cache missing — run npm run sync:metro with TFNSW_API_KEY in .env");
  }
  return gtfsDir;
}

/** Returns path to extracted GTFS folder (routes.txt, stops.txt, …). */
export async function prepareGtfsDir() {
  const extractRoot = path.join(root, ".cache", "gtfs-extract");
  const gtfsDir = path.join(extractRoot, "gtfs");
  if (fs.existsSync(path.join(gtfsDir, "stops.txt"))) {
    console.log("Using cached GTFS extract:", gtfsDir);
    return gtfsDir;
  }
  const apiKey = assertTfnswKey();
  const cacheDir = path.join(root, ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const zipPath = path.join(cacheDir, "tfnsw-gtfs-complete.zip");
  console.log("Downloading TfNSW GTFS Complete…");
  await downloadZip(apiKey, zipPath);
  console.log("Extracting GTFS…");
  fs.rmSync(extractRoot, { recursive: true, force: true });
  unzipToDir(zipPath, gtfsDir);
  return gtfsDir;
}

export { root };
