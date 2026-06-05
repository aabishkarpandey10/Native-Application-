/**
 * Download & import Transport NSW train timetable PDFs → backend/data/timetables/*.json
 *
 * Usage:
 *   npm run import:timetables
 *   node scripts/import-train-timetables.mjs [T8 T4 L2 ...]   # optional line filter
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildStationNameMap, CBD_STATION_IDS } from "../backend/data/timetables/stationNameMap.js";
import { rebuildTimetableIndex } from "../backend/data/timetableLoader.js";
import { SYDNEY_STATIONS } from "../backend/data/sydneyStations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const sourceDir = path.join(root, "backend", "data", "timetables", "source");
const outDir = path.join(root, "backend", "data", "timetables");

/** @type {Array<{ id: string, routes: string[], url: string, file: string, validFrom: string, lineName: string, outboundDests: string[], hubDest?: string, throughDest?: string }>} */
export const LINE_PDF_CONFIGS = [
  {
    id: "T1",
    routes: ["T1"],
    lineName: "T1 Western Line",
    url: "https://transportnsw.info/documents/timetables/93-T1-Western-Line-20260419.pdf",
    file: "T1-Western-Line-20260419.pdf",
    validFrom: "2026-04-19",
    outboundDests: ["Penrith", "Richmond", "Emu Plains"],
    hubDest: "Central",
    throughDest: "Chatswood",
  },
  {
    id: "T8",
    routes: ["T8"],
    lineName: "T8 Airport & South Line",
    url: "https://transportnsw.info/documents/timetables/93-T8-Airport-South-Line-20251019.pdf",
    file: "T8-Airport-South-Line-20251019.pdf",
    validFrom: "2025-10-19",
    outboundDests: ["Macarthur", "Revesby", "Domestic Airport"],
    hubDest: "Central",
  },
  {
    id: "T2",
    routes: ["T2", "T3"],
    lineName: "T2 Inner West & T3 Bankstown/Liverpool",
    url: "https://transportnsw.info/documents/timetables/93-T2-Inner-West-Leppington-Line-20250629.pdf",
    file: "T2-Inner-West-Leppington-Line-20250629.pdf",
    validFrom: "2025-06-29",
    outboundDests: ["Parramatta", "Leppington", "Liverpool", "Lidcombe", "Bankstown"],
    hubDest: "Central",
  },
  {
    id: "T4",
    routes: ["T4"],
    lineName: "T4 Eastern Suburbs & Illawarra Line",
    url: "https://transportnsw.info/documents/timetables/93-T4-Eastern-Suburbs-Illawarra-Line-20260419.pdf",
    file: "T4-Eastern-Suburbs-Illawarra-Line-20260419.pdf",
    validFrom: "2026-04-19",
    outboundDests: ["Cronulla", "Waterfall", "Bondi Junction"],
    hubDest: "Central",
    throughDest: "Bondi Junction",
  },
  {
    id: "T5",
    routes: ["T5"],
    lineName: "T5 Cumberland Line",
    url: "https://transportnsw.info/documents/timetables/93-T5-Cumberland-Line-20250419.pdf",
    file: "T5-Cumberland-Line-20250419.pdf",
    validFrom: "2025-04-19",
    outboundDests: ["Richmond", "Leppington", "Parramatta"],
    hubDest: "Parramatta",
  },
  {
    id: "T6",
    routes: ["T6"],
    lineName: "T6 Lidcombe & Bankstown Line",
    url: "https://transportnsw.info/documents/timetables/93-T6-Lidcombe-Bankstown-Line-20241020.pdf",
    file: "T6-Lidcombe-Bankstown-Line-20241020.pdf",
    validFrom: "2024-10-20",
    outboundDests: ["Bankstown", "Lidcombe"],
    hubDest: "Lidcombe",
  },
  {
    id: "T7",
    routes: ["T7"],
    lineName: "T7 Olympic Park Line",
    url: "https://transportnsw.info/documents/timetables/93-T7-Olympic-Park-Line-20241020.pdf",
    file: "T7-Olympic-Park-Line-20241020.pdf",
    validFrom: "2024-10-20",
    outboundDests: ["Olympic Park", "Lidcombe"],
    hubDest: "Central",
  },
  {
    id: "T9",
    routes: ["T9"],
    lineName: "T9 Northern Line",
    url: "https://transportnsw.info/documents/timetables/93-T9-Northern-Line-20250419.pdf",
    file: "T9-Northern-Line-20250419.pdf",
    validFrom: "2025-04-19",
    outboundDests: ["Hornsby", "Berowra", "Gordon", "Strathfield"],
    hubDest: "Central",
    throughDest: "Hornsby",
  },
  {
    id: "L1",
    routes: ["L1"],
    lineName: "L1 Dulwich Hill Line",
    url: "https://transportnsw.info/documents/timetables/93-L1-Dulwich-Hill-Line-20260119.pdf",
    file: "L1-Dulwich-Hill-Line-20260119.pdf",
    validFrom: "2026-01-19",
    outboundDests: ["Dulwich Hill", "Central"],
    hubDest: "Central",
  },
  {
    id: "L2",
    routes: ["L2"],
    lineName: "L2 Randwick Line",
    url: "https://transportnsw.info/documents/timetables/93-L2-Randwick-Line-20260119.pdf",
    file: "L2-Randwick-Line-20260119.pdf",
    validFrom: "2026-01-19",
    outboundDests: ["Randwick", "Circular Quay"],
    hubDest: "Circular Quay",
  },
  {
    id: "L3",
    routes: ["L3"],
    lineName: "L3 Kingsford Line",
    url: "https://transportnsw.info/documents/timetables/93-L3-Kingsford-Line-20260119.pdf",
    file: "L3-Kingsford-Line-20260119.pdf",
    validFrom: "2026-01-19",
    outboundDests: ["Kingsford", "Circular Quay"],
    hubDest: "Circular Quay",
  },
];

const STATION_IDS = buildStationNameMap();
const STATIONS_BY_ID = new Map(SYDNEY_STATIONS.map((s) => [s.id, s]));

function normalizeStopLabel(label) {
  return String(label || "")
    .toLowerCase()
    .split(",")[0]
    .replace(/\s+station$/i, "")
    .replace(/\s+light\s+rail(\s+stop)?$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function isLightRailConfig(cfg) {
  return String(cfg?.id || "").toUpperCase().startsWith("L");
}

function resolveStationId(rawLabel, label, baseLabel, tailLabel, cfg) {
  const candidates = [
    STATION_IDS[label],
    STATION_IDS[rawLabel],
    STATION_IDS[baseLabel],
    tailLabel ? STATION_IDS[tailLabel] : undefined,
  ].filter(Boolean);

  if (!isLightRailConfig(cfg)) {
    return candidates[0] || null;
  }

  // For L1/L2/L3 imports, prefer light rail stop IDs for ambiguous names like "Central" / "Circular Quay".
  const lrCandidate = candidates.find((id) => {
    const st = STATIONS_BY_ID.get(id);
    return st?.mode === "lightrail" || st?.mode === "light_rail";
  });
  if (lrCandidate) return lrCandidate;

  const normRaw = normalizeStopLabel(rawLabel);
  const normBase = normalizeStopLabel(baseLabel);
  const byName = SYDNEY_STATIONS.find((s) => {
    if (!(s.mode === "lightrail" || s.mode === "light_rail")) return false;
    const n = normalizeStopLabel(s.name);
    return n === normRaw || n === normBase;
  });
  if (byName) return byName.id;

  return candidates[0] || null;
}

function parseTimes(raw) {
  const normalized = raw.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
  const times = [];
  for (const token of normalized.split(" ")) {
    if (token === "i" || token === "e") continue;
    const m = token.match(/^([ei])?(\d{1,2}:\d{2})$/);
    if (!m) continue;
    const [h, min] = m[2].split(":");
    times.push(`${h.padStart(2, "0")}:${min}`);
  }
  return times;
}

function parseStationRow(line, cfg) {
  const trimmed = line.trim().replace(/\t/g, " ").replace(/\s+/g, " ");
  if (!trimmed || trimmed.startsWith("|") || trimmed.startsWith("Service Information")) return null;

  const match = trimmed.match(
    /^([A-Za-z0-9][A-Za-z0-9\s,.'&/-]+?)(?:\s+(ARR|DEP))?\s+(\d{1,2}:\d{2}\b.*)$/
  );
  if (!match) return null;

  const rawLabel = match[1].trim();
  const label = match[2] ? `${rawLabel} ${match[2]}` : rawLabel;
  const baseLabel = rawLabel
    .split(",")[0]
    .replace(/\s+Station$/i, "")
    .replace(/\s+Light\s+Rail(\s+stop)?$/i, "")
    .trim();
  const tailLabel = rawLabel.includes(",")
    ? rawLabel.split(",").at(-1)?.trim() || ""
    : "";
  const stationId = resolveStationId(rawLabel, label, baseLabel, tailLabel, cfg);
  if (!stationId) return null;

  const times = parseTimes(match[3]);
  if (times.length === 0) return null;

  return { stationId, times };
}

function detectSection(line, cfg) {
  const t = line.trim();
  if (!/^T\d|^T2\/3|^L\d/.test(t)) return null;
  if (/Line and T3|Inner West Line and|Bankstown Line$/i.test(t) && !/\d:\d/.test(t)) return null;
  if (t.length > 100 && !/\d:\d/.test(t)) return null;

  if (/\bto City\b/i.test(t) || /\bto City \//i.test(t)) {
    return { kind: "inbound", hub: cfg.hubDest || "Central" };
  }
  if (/\bCity to\b/i.test(t)) {
    return { kind: "outbound" };
  }
  if (/to Bondi Junction/i.test(t) && !/Bondi Junction to/i.test(t)) {
    return { kind: "inbound", hub: "Bondi Junction" };
  }
  if (/Bondi Junction to/i.test(t)) {
    return { kind: "outbound" };
  }
  if (/Hornsby to North Shore via City/i.test(t)) {
    return { kind: "inbound", hub: cfg.hubDest || "Central" };
  }
  if (/North Shore to Hornsby via City/i.test(t)) {
    return { kind: "outbound" };
  }

  const terminal = t.match(/^[TL]\d+\s+(.+?)\s+to\s+(.+?)$/i);
  if (terminal && !/\bCity\b/i.test(t) && !/Bondi Junction/i.test(t)) {
    const destPool = terminal[2]
      .replace(/\s+via\s+.*$/i, "")
      .split(/\s+or\s+/)
      .map((d) => d.trim())
      .filter(Boolean);
    return { kind: "terminal", destPool };
  }

  return null;
}

function pickRoute(cfg, destination) {
  if (cfg.routes.includes("T3") && /Liverpool|Lidcombe|Bankstown/i.test(destination)) return "T3";
  if (cfg.routes.includes("T2") && /Parramatta|Leppington/i.test(destination)) return "T2";
  return cfg.routes[0];
}

function destinationFor(stationId, section, cfg, index) {
  const cbd = CBD_STATION_IDS.has(stationId);

  if (section.kind === "inbound") {
    if (cbd && cfg.throughDest) return cfg.throughDest;
    return section.hub || cfg.hubDest || "Central";
  }
  if (section.kind === "outbound") {
    return cfg.outboundDests[index % cfg.outboundDests.length];
  }
  if (section.kind === "terminal") {
    return section.destPool[index % section.destPool.length];
  }
  return cfg.hubDest || "Central";
}

function parseSections(text, cfg) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const header = detectSection(line, cfg);
    if (header) {
      current = { ...header, rows: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const row = parseStationRow(line, cfg);
    if (row) current.rows.push(row);
  }

  return sections;
}

function buildTimetable(sections, cfg) {
  /** @type {Record<string, { departures: object[] }>} */
  const stations = {};

  for (const section of sections) {
    for (const row of section.rows) {
      // Inbound rows at CBD stations are arrivals, not boardable departures.
      if (section.kind === "inbound" && CBD_STATION_IDS.has(row.stationId) && !cfg.throughDest) {
        continue;
      }
      if (!stations[row.stationId]) stations[row.stationId] = { departures: [] };
      row.times.forEach((time, i) => {
        const destination = destinationFor(row.stationId, section, cfg, i);
        stations[row.stationId].departures.push({
          scheduledTime: time,
          destination,
          direction: section.kind,
          routeNumber: pickRoute(cfg, destination),
        });
      });
    }
  }

  for (const entry of Object.values(stations)) {
    entry.departures.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const seen = new Set();
    entry.departures = entry.departures.filter((d) => {
      const key = `${d.scheduledTime}|${d.routeNumber}|${d.destination}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return stations;
}

async function extractPdfText(pdfPath) {
  const { PDFParse } = await import("pdf-parse");
  const buffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse(new Uint8Array(buffer));
  const result = await parser.getText();
  return result.text || String(result);
}

async function ensurePdf(cfg) {
  fs.mkdirSync(sourceDir, { recursive: true });
  const pdfPath = path.join(sourceDir, cfg.file);
  if (fs.existsSync(pdfPath)) return pdfPath;

  console.log(`  Downloading ${cfg.id}…`);
  const res = await fetch(cfg.url);
  if (!res.ok) throw new Error(`${cfg.id} download failed: ${res.status}`);
  fs.writeFileSync(pdfPath, Buffer.from(await res.arrayBuffer()));
  return pdfPath;
}

async function importLine(cfg) {
  const pdfPath = await ensurePdf(cfg);
  const text = await extractPdfText(pdfPath);
  const txtPath = path.join(sourceDir, cfg.file.replace(/\.pdf$/i, ".txt"));
  fs.writeFileSync(txtPath, text, "utf8");

  const sections = parseSections(text, cfg);
  const stations = buildTimetable(sections, cfg);
  const stationCount = Object.keys(stations).length;
  const tripCount = Object.values(stations).reduce((n, s) => n + s.departures.length, 0);

  const payload = {
    route: cfg.id,
    routes: cfg.routes,
    lineName: cfg.lineName,
    validFrom: cfg.validFrom,
    dayType: "weekday",
    source: cfg.url,
    importedAt: new Date().toISOString(),
    stations,
  };

  const outPath = path.join(outDir, `${cfg.id.toLowerCase()}-weekday.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(`  ✓ ${cfg.id}: ${tripCount} departures, ${stationCount} stations → ${path.basename(outPath)}`);
  return { cfg, stationCount, tripCount, outPath };
}

async function main() {
  const filter = new Set(process.argv.slice(2).map((a) => a.toUpperCase()));
  const lines = filter.size
    ? LINE_PDF_CONFIGS.filter((c) => filter.has(c.id))
    : LINE_PDF_CONFIGS;

  if (lines.length === 0) {
    console.error("No matching lines. Available:", LINE_PDF_CONFIGS.map((c) => c.id).join(", "));
    process.exit(1);
  }

  console.log(`Importing ${lines.length} timetable PDF(s)…\n`);
  const results = [];
  for (const cfg of lines) {
    results.push(await importLine(cfg));
  }

  const manifest = {
    importedAt: new Date().toISOString(),
    lines: results.map(({ cfg, stationCount, tripCount }) => ({
      route: cfg.id,
      routes: cfg.routes,
      lineName: cfg.lineName,
      validFrom: cfg.validFrom,
      source: cfg.url,
      stationCount,
      tripCount,
    })),
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  rebuildTimetableIndex();

  const totalTrips = results.reduce((n, r) => n + r.tripCount, 0);
  console.log(`\nDone — ${totalTrips} scheduled departures across ${results.length} lines.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
