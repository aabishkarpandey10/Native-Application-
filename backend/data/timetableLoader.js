import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { LIGHT_RAIL_LINE_STATION_IDS } from "./lightRailNetworkData.js";
import { METRO_LINE_STATION_IDS } from "./metroNetworkData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMETABLES_DIR = path.join(__dirname, "timetables");
const INDEX_PATH = path.join(TIMETABLES_DIR, "index.json");

const LR_FILES = new Set(["l1-weekday.json", "l2-weekday.json", "l3-weekday.json"]);
const METRO_FILES = new Set(["m1-weekday.json"]);

/** @type {Map<string, { stations: Record<string, { departures: object[] }> }>} */
const fileCache = new Map();

/** @type {{ stationIndex: Record<string, string[]> } | null} */
let indexCache = null;

/** Pre-warmed light rail + metro timetable JSON at startup. */
let lightRailMerged = null;
let metroMerged = null;

/** Per-station merged departures (avoids re-merging line JSON on every trip search). */
const stationMergeCache = new Map();

function readIndex() {
  if (indexCache) return indexCache;
  if (fs.existsSync(INDEX_PATH)) {
    try {
      indexCache = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
      return indexCache;
    } catch {
      // rebuild below
    }
  }
  indexCache = buildIndexFromDisk();
  try {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(indexCache));
  } catch {
    // ignore
  }
  return indexCache;
}

function buildIndexFromDisk() {
  /** @type {Record<string, Set<string>>} */
  const stationIndex = {};
  if (!fs.existsSync(TIMETABLES_DIR)) {
    return { stationIndex: {}, builtAt: new Date().toISOString() };
  }

  for (const file of fs.readdirSync(TIMETABLES_DIR).filter((f) => f.endsWith("-weekday.json"))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(TIMETABLES_DIR, file), "utf8"));
      for (const stationId of Object.keys(data.stations || {})) {
        if (!stationIndex[stationId]) stationIndex[stationId] = new Set();
        stationIndex[stationId].add(file);
      }
    } catch {
      // skip
    }
  }

  return {
    builtAt: new Date().toISOString(),
    stationIndex: Object.fromEntries(
      Object.entries(stationIndex).map(([id, set]) => [id, [...set]])
    ),
  };
}

export function rebuildTimetableIndex() {
  indexCache = null;
  fileCache.clear();
  stationMergeCache.clear();
  lightRailMerged = null;
  metroMerged = null;
  const index = readIndex();
  try {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index));
  } catch {
    // ignore
  }
  return index;
}

export function registerStationInIndex(stationId, filename) {
  const index = readIndex();
  if (!index.stationIndex[stationId]) index.stationIndex[stationId] = [];
  if (!index.stationIndex[stationId].includes(filename)) {
    index.stationIndex[stationId].push(filename);
  }
  fileCache.delete(filename);
  lightRailMerged = null;
  metroMerged = null;
}

function loadFile(filename) {
  if (fileCache.has(filename)) return fileCache.get(filename);
  const filePath = path.join(TIMETABLES_DIR, filename);
  if (!fs.existsSync(filePath)) return { stations: {} };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const payload = { stations: data.stations || {} };
    fileCache.set(filename, payload);
    return payload;
  } catch {
    return { stations: {} };
  }
}

function mergeFiles(filenames) {
  /** @type {Record<string, { departures: object[] }>} */
  const stations = {};
  for (const file of filenames) {
    const { stations: chunk } = loadFile(file);
    for (const [stationId, entry] of Object.entries(chunk)) {
      if (!entry?.departures?.length) continue;
      if (!stations[stationId]) stations[stationId] = { departures: [] };
      stations[stationId].departures.push(...entry.departures);
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
  return { stations };
}

function filesForStation(stationId) {
  const index = readIndex();
  const listed = index.stationIndex[stationId];
  if (listed?.length) return listed;

  // Fallback: scan only small LR files for unknown LR ids
  if (/_LR$/i.test(stationId)) {
    return [...LR_FILES];
  }
  if (/_M$/i.test(stationId)) {
    return [...METRO_FILES];
  }
  return null;
}

/** Load timetable rows for one station (only reads JSON files that contain it). */
export function getStationTimetableData(stationId) {
  if (!stationId) return { stations: {} };

  if (/_LR$/i.test(stationId) && lightRailMerged?.stations[stationId]) {
    return { stations: { [stationId]: lightRailMerged.stations[stationId] } };
  }

  if (/_M$/i.test(stationId) && metroMerged?.stations[stationId]) {
    return { stations: { [stationId]: metroMerged.stations[stationId] } };
  }

  const cachedStation = stationMergeCache.get(stationId);
  if (cachedStation) return cachedStation;

  const files = filesForStation(stationId);
  if (!files?.length) return { stations: {} };

  const merged = mergeFiles(files);
  const entry = merged.stations[stationId];
  const payload = entry ? { stations: { [stationId]: entry } } : { stations: {} };
  if (entry) stationMergeCache.set(stationId, payload);
  return payload;
}

/** Warm light-rail PDF cache at startup (fast subsequent departures/trips). */
export function warmLightRailTimetables() {
  if (lightRailMerged) return lightRailMerged;
  lightRailMerged = mergeFiles([...LR_FILES]);
  return lightRailMerged;
}

export function warmMetroTimetables() {
  if (metroMerged) return metroMerged;
  metroMerged = mergeFiles([...METRO_FILES]);
  return metroMerged;
}

export function warmCoreTimetables() {
  warmLightRailTimetables();
  warmMetroTimetables();
}

function isOnLightRailBranch(stationId) {
  return Object.values(LIGHT_RAIL_LINE_STATION_IDS).some((ids) => ids.includes(stationId));
}

function isOnMetroBranch(stationId) {
  return Object.values(METRO_LINE_STATION_IDS).some((ids) => ids.includes(stationId));
}

export function hasStationTimetable(stationId) {
  if (/_LR$/i.test(stationId)) {
    warmLightRailTimetables();
    if (lightRailMerged?.stations[stationId]?.departures?.length) return true;
    return isOnLightRailBranch(stationId);
  }
  if (/_M$/i.test(stationId)) {
    warmMetroTimetables();
    if (metroMerged?.stations[stationId]?.departures?.length) return true;
    return isOnMetroBranch(stationId);
  }
  const files = filesForStation(stationId);
  if (!files?.length) return false;
  for (const file of files) {
    const { stations } = loadFile(file);
    if (stations[stationId]?.departures?.length) return true;
  }
  return false;
}
