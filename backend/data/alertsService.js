import { getAlerts } from "./adminStore.js";
import { isResolvedAlertText } from "./alertFilters.js";
import {
  countByCategory,
  enrichAlertClassification,
  isTrackworkAlert,
} from "./alertClassification.js";
import { fetchTransportNswGtfsAlerts } from "./gtfsRealtimeAlerts.js";
import { isTfnswKeyConfigured, config } from "../src/config/index.js";
import { mapProductClass } from "./tfnswHelpers.js";
import { parseTfnswTime, toIsoString } from "./tfnswTime.js";

export { isResolvedAlertText } from "./alertFilters.js";

const TFNSW_API_BASE = config.tfnsw.baseUrl;
/** Success responses are not reused — each request pulls live Transport NSW data. */
const CACHE_TTL_MS = 0;
const FAILURE_CACHE_MS = 5_000;

let cache = null;
let failureCache = null;
let inFlight = null;

function sydneyFilterDateValid(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${pick("day")}-${pick("month")}-${pick("year")}`;
}

function isMessageStillActive(message, now = new Date()) {
  const ts = message?.timestamps;
  if (ts?.expiration) {
    const exp = parseTfnswTime(ts.expiration);
    if (exp.getTime() < now.getTime() - 60_000) return false;
  }

  const window = ts?.validity?.[0] ?? ts?.availability;
  if (window?.to && window.isOpenEnd !== true) {
    const end = parseTfnswTime(window.to);
    if (end.getTime() < now.getTime() - 60_000) return false;
  }

  const link = message?.infoLinks?.[0] ?? {};
  const title = (link.subtitle || link.smsText || "").trim();
  const description = (link.content || link.speechText || message?.properties?.speechText || "").trim();
  if (isResolvedAlertText(title, description)) return false;

  const pub = String(message?.properties?.publicationStatus || message?.publicationStatus || "").toLowerCase();
  if (pub && pub !== "current" && pub !== "active") return false;

  return true;
}

function inferModeFromMessage(message) {
  const lines = message?.affected?.lines ?? [];
  for (const line of lines) {
    const fromProduct = mapProductClass(line?.product?.class);
    if (fromProduct) return fromProduct;
    const num = String(line?.number || line?.name || "");
    if (/^F\d/i.test(num)) return "ferry";
    if (/^M\d/i.test(num)) return "metro";
    if (/^L\d/i.test(num)) return "light_rail";
    if (/^T\d/i.test(num)) return "train";
    if (/bus/i.test(num)) return "bus";
  }
  const text = `${message?.infoLinks?.[0]?.content || ""} ${message?.infoLinks?.[0]?.subtitle || ""}`.toLowerCase();
  if (text.includes("ferry")) return "ferry";
  if (text.includes("metro")) return "metro";
  if (text.includes("light rail")) return "light_rail";
  if (text.includes("bus")) return "bus";
  return "train";
}

function inferSeverity(message) {
  const priority = String(message?.priority || "normal").toLowerCase();
  const announcement = String(message?.properties?.announcementType || "").toLowerCase();
  const blob = [
    message?.infoLinks?.[0]?.content,
    message?.infoLinks?.[0]?.subtitle,
    message?.properties?.speechText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    announcement === "trackwork" ||
    /trackwork|track work|planned maintenance|changed timetable|rail replacement|weekend work/i.test(
      blob
    )
  ) {
    return "warning";
  }
  if (
    /cancel+ed|suspended|not stopping|major delay|significant delay|avoid|no trains|buses replace|replacement bus|emergency|evacuat/i.test(
      blob
    )
  ) {
    return "critical";
  }
  if (/delay|late|running late|allow extra|disruption|divert|altered/i.test(blob)) {
    return "warning";
  }
  if (announcement === "liftsescalators") {
    return "info";
  }
  if (priority === "verylow" || priority === "low") return "info";
  if (priority === "high" || priority === "veryhigh") return "critical";
  return announcement === "servicechange" ? "warning" : "info";
}

function extractAffectedRoutes(message) {
  const routes = new Set();
  for (const line of message?.affected?.lines ?? []) {
    const num = String(line?.number || "");
    const m = num.match(/\b(T\d+|M\d+|L\d+|F\d+|\d{3})\b/i);
    if (m) routes.add(m[1].toUpperCase());
    else if (num.trim()) routes.add(num.trim().slice(0, 12));
  }
  return [...routes];
}

function stableAlertId(message) {
  if (message?.id) return `tfnsw_${message.id}`;
  const link = message?.infoLinks?.[0];
  const seed = [link?.subtitle, link?.content, message?.properties?.messageRef]
    .filter(Boolean)
    .join("|");
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `tfnsw_gen_${Math.abs(hash)}`;
}

function mapTfnswMessage(message) {
  if (!message?.infoLinks?.length) return null;
  if (!isMessageStillActive(message)) return null;

  const link = message.infoLinks[0] ?? {};
  const title = (link.subtitle || link.smsText || "Service alert").trim();
  const description = (link.content || link.speechText || message?.properties?.speechText || title).trim();
  if (isResolvedAlertText(title, description)) return null;

  const modified = message?.timestamps?.lastModification
    ? toIsoString(parseTfnswTime(message.timestamps.lastModification))
    : new Date().toISOString();

  return {
    id: stableAlertId(message),
    mode: inferModeFromMessage(message),
    title,
    description,
    severity: inferSeverity(message),
    affectedRoutes: extractAffectedRoutes(message),
    affectedLine: extractAffectedRoutes(message)[0] ?? "",
    updatedAt: modified,
    source: "tfnsw",
    url: link.url || null,
    priority: message?.priority ?? "normal",
    announcementType: message?.properties?.announcementType ?? null,
    status: "active",
  };
}

function normalizeAdminAlert(alert) {
  if (alert.resolved || alert.dismissed || alert.status === "resolved") return null;

  if (alert.expiresAt) {
    const exp = parseTfnswTime(alert.expiresAt);
    if (exp.getTime() < Date.now() - 60_000) return null;
  }

  const rawMode = alert.mode === "lightrail" ? "light_rail" : alert.mode;
  const mode = ["train", "metro", "bus", "light_rail", "ferry"].includes(rawMode)
    ? rawMode
    : "train";
  const affected =
    alert.affectedRoutes ??
    (alert.affectedLine ? [alert.affectedLine] : alert.affected_routes ?? []);

  const title = alert.title || "Service alert";
  const description = alert.description || title;
  if (isResolvedAlertText(title, description)) return null;

  return {
    id: alert.id,
    mode,
    title,
    description,
    severity: alert.severity || "info",
    affectedRoutes: Array.isArray(affected) ? affected : [String(affected)],
    affectedLine: alert.affectedLine ?? affected[0] ?? "",
    updatedAt: alert.updatedAt || new Date().toISOString(),
    source: "admin",
    url: null,
    status: "active",
  };
}

async function fetchTfnswServiceAlerts(apiKey) {
  const filterDateValid = sydneyFilterDateValid();
  const url = `${TFNSW_API_BASE}/add_info?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&filterDateValid=${encodeURIComponent(filterDateValid)}&filterPublicationStatus=current`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Apikey ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`TfNSW add_info ${response.status}`);
  }

  const data = await response.json();
  const current = data?.infos?.current;
  if (!Array.isArray(current)) return [];

  const mapped = current.map(mapTfnswMessage).filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const alert of mapped) {
    if (seen.has(alert.id)) continue;
    seen.add(alert.id);
    unique.push(alert);
  }

  return unique.sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    const dr = (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
    if (dr !== 0) return dr;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function filterActiveAlerts(alerts) {
  return alerts.filter((a) => {
    if (a.status === "resolved") return false;
    if (isResolvedAlertText(a.title, a.description)) return false;
    return true;
  });
}

function normalizeTitleKey(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/^trackwork:\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Merge TfNSW GTFS-RT + add_info (transportnsw.info) without duplicate headlines. */
function mergeAlertFeeds(...lists) {
  const out = [];
  const seenIds = new Set();
  const seenTitles = new Set();

  for (const list of lists) {
    for (const alert of list) {
      if (!alert?.id) continue;
      if (seenIds.has(alert.id)) continue;

      const titleKey = normalizeTitleKey(alert.title);
      if (titleKey && seenTitles.has(titleKey)) continue;

      seenIds.add(alert.id);
      if (titleKey) seenTitles.add(titleKey);
      out.push(alert);
    }
  }

  return out.sort((a, b) => {
    const trackA = isTrackworkAlert(a) ? 0 : 1;
    const trackB = isTrackworkAlert(b) ? 0 : 1;
    if (trackA !== trackB) return trackA - trackB;
    const rank = { critical: 0, warning: 1, info: 2 };
    const dr = (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
    if (dr !== 0) return dr;
    return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
  });
}

async function pullLiveTransportNswAlerts(apiKey) {
  const asOf = new Date().toISOString();
  const adminAlerts = filterActiveAlerts(
    getAlerts().map(normalizeAdminAlert).filter(Boolean)
  );
  const adminIds = new Set(adminAlerts.map((a) => a.id));

  const [addInfoResult, gtfsResult] = await Promise.allSettled([
    fetchTfnswServiceAlerts(apiKey),
    fetchTransportNswGtfsAlerts(apiKey),
  ]);

  const addInfoOk = addInfoResult.status === "fulfilled";
  const gtfsOk = gtfsResult.status === "fulfilled";
  const addInfo = addInfoOk ? addInfoResult.value : [];
  const gtfsAlerts = gtfsOk ? gtfsResult.value : [];

  if (!addInfoOk) {
    console.warn("TfNSW add_info alerts failed:", addInfoResult.reason?.message);
  }
  if (!gtfsOk) {
    console.warn("TfNSW GTFS-RT alerts failed:", gtfsResult.reason?.message);
  }

  const liveReachable = addInfoOk || gtfsOk;
  const merged = filterActiveAlerts(
    mergeAlertFeeds(
      gtfsAlerts,
      addInfo.filter((a) => !adminIds.has(a.id)),
      adminAlerts
    )
  )
    .map(enrichAlertClassification)
    .slice(0, 120);

  const { trackworkCount, criticalCount } = countByCategory(merged);

  return {
    alerts: merged,
    asOf,
    source: liveReachable
      ? adminAlerts.length
        ? "transportnsw+admin"
        : "transportnsw"
      : "transportnsw-unavailable",
    tfnswLive: liveReachable,
    dataSource: "https://transportnsw.info",
    trackworkCount,
    criticalCount,
    count: merged.length,
  };
}

/**
 * Live Transport NSW service alerts (add_info + GTFS-RT). No stale server cache.
 */
export async function getServiceAlerts(apiKey, { forceRefresh = false } = {}) {
  if (forceRefresh) clearAlertsCache();

  const now = Date.now();
  if (!forceRefresh && CACHE_TTL_MS > 0 && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.payload;
  }
  if (
    !forceRefresh &&
    failureCache &&
    now - failureCache.fetchedAt < FAILURE_CACHE_MS
  ) {
    return failureCache.payload;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      if (!isTfnswKeyConfigured()) {
        const adminOnly = filterActiveAlerts(
          getAlerts().map(normalizeAdminAlert).filter(Boolean)
        );
        const payload = {
          alerts: adminOnly,
          asOf: new Date().toISOString(),
          source: "admin",
          tfnswLive: false,
          dataSource: null,
          count: adminOnly.length,
        };
        cache = { fetchedAt: Date.now(), payload };
        return payload;
      }

      const payload = await pullLiveTransportNswAlerts(apiKey);
      cache = { fetchedAt: Date.now(), payload };
      failureCache = null;
      return payload;
    } catch (err) {
      console.warn("Transport NSW alerts failed:", err.message);
      const payload = {
        alerts: [],
        asOf: new Date().toISOString(),
        source: "transportnsw-unavailable",
        tfnswLive: false,
        dataSource: "https://transportnsw.info",
        count: 0,
      };
      failureCache = { fetchedAt: Date.now(), payload };
      return payload;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function clearAlertsCache() {
  cache = null;
  failureCache = null;
  inFlight = null;
}
