import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getCoreStations } from "./stationRegistry.js";
import { APP_CONFIG_DEFAULTS, normalizeAppConfig } from "./appConfigDefaults.js";
import { isResolvedAlertText } from "./alertFilters.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "app-data.json");
const NETWORK_MAP_FILE = join(__dirname, "uploads", "network-map.png");
const APP_LOGO_FILE = join(__dirname, "uploads", "app-logo.png");

function hasUploadedNetworkMapFile() {
  return existsSync(NETWORK_MAP_FILE);
}

function hasUploadedAppLogoFile() {
  return existsSync(APP_LOGO_FILE);
}

/** No demo alerts — only live TfNSW + admin-created entries. */
const DEFAULT_ALERTS = [];

const LEGACY_DEMO_ALERT_IDS = new Set([
  "alert_t1",
  "alert_t4",
  "alert_l2",
  "alert_f1",
]);

function pruneStoredAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  return alerts.filter((a) => {
    if (!a?.id || !a?.title) return false;
    if (LEGACY_DEMO_ALERT_IDS.has(a.id)) return false;
    if (a.resolved || a.dismissed || a.status === "resolved") return false;
    if (a.expiresAt && new Date(a.expiresAt).getTime() < Date.now() - 60_000) return false;
    return !isResolvedAlertText(a.title, a.description || "");
  });
}

export function createDefaultAppData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    appConfig: { ...APP_CONFIG_DEFAULTS },
    stations: getCoreStations().map((s) => ({ ...s, disabled: false })),
    alerts: DEFAULT_ALERTS.map((a) => ({ ...a })),
  };
}

let cache = null;

function loadFromDisk() {
  if (!existsSync(DATA_PATH)) {
    const data = createDefaultAppData();
    saveToDisk(data);
    return data;
  }
  try {
    const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    const pruned = pruneStoredAlerts(data.alerts);
    if (pruned.length !== (data.alerts || []).length) {
      data.alerts = pruned;
      saveToDisk(data);
    }
    return data;
  } catch {
    const data = createDefaultAppData();
    saveToDisk(data);
    return data;
  }
}

function saveToDisk(data) {
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  data.updatedAt = new Date().toISOString();
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  cache = data;
}

export function getAppData() {
  if (!cache) cache = loadFromDisk();
  return cache;
}

export function saveAppData(data) {
  saveToDisk(data);
}

export function getAppConfig() {
  let cfg = normalizeAppConfig(getAppData().appConfig);
  const hasMapUpload = hasUploadedNetworkMapFile();
  const hasLogoUpload = hasUploadedAppLogoFile();
  const patches = {};
  const rawLogoUrl = String(getAppData().appConfig?.appLogoUrl ?? "").trim();
  if (rawLogoUrl && rawLogoUrl !== cfg.appLogoUrl) {
    patches.appLogoUrl = cfg.appLogoUrl;
  }
  if (hasLogoUpload && cfg.appLogoUrl) {
    patches.appLogoUrl = "";
  }
  if (hasLogoUpload && !cfg.appLogoUpdatedAt) {
    patches.appLogoUpdatedAt = new Date().toISOString();
  }
  const rawUrl = String(getAppData().appConfig?.networkMapUrl ?? "").trim();
  if (rawUrl && rawUrl !== cfg.networkMapUrl) {
    patches.networkMapUrl = cfg.networkMapUrl;
  }
  if (hasMapUpload && cfg.networkMapUrl) {
    patches.networkMapUrl = "";
  }
  if (hasMapUpload && !cfg.networkMapUpdatedAt) {
    patches.networkMapUpdatedAt = new Date().toISOString();
  }
  if (Object.keys(patches).length > 0) {
    cfg = setAppConfig(patches);
  }
  return {
    ...cfg,
    appLogoHasUpload: hasLogoUpload,
    networkMapHasUpload: hasMapUpload,
  };
}

export function setAppConfig(config) {
  const data = getAppData();
  data.appConfig = normalizeAppConfig({ ...data.appConfig, ...config });
  saveAppData(data);
  return data.appConfig;
}

export function getStations() {
  const data = getAppData();
  const savedById = new Map((data.stations || []).map((s) => [s.id, s]));
  const merged = [];
  const seen = new Set();

  for (const base of getCoreStations()) {
    const saved = savedById.get(base.id);
    seen.add(base.id);
    if (saved) {
      merged.push({
        ...base,
        ...saved,
        disabled: !!saved.disabled,
      });
    } else {
      merged.push({ ...base, disabled: false });
    }
  }

  for (const saved of data.stations || []) {
    if (seen.has(saved.id)) continue;
    merged.push({
      ...saved,
      disabled: !!saved.disabled,
    });
  }

  return merged;
}

export function setStations(stations) {
  const data = getAppData();
  data.stations = stations;
  saveAppData(data);
  return data.stations;
}

export function getAlerts() {
  const data = getAppData();
  return pruneStoredAlerts(data.alerts).map((a) => ({
    ...a,
    affectedLine: a.affectedLine ?? a.affected_routes ?? a.affectedRoutes?.[0],
    updatedAt: a.updatedAt || new Date().toISOString(),
  }));
}

export function setAlerts(alerts) {
  const data = getAppData();
  data.alerts = pruneStoredAlerts(alerts);
  saveAppData(data);
  return data.alerts;
}

export function resetAppData() {
  const data = createDefaultAppData();
  saveAppData(data);
  return data;
}
