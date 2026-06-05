import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { isResolvedAlertText } from "./alertFilters.js";

const GTFS_ALERT_MODES = [
  { feed: "sydneytrains", mode: "train" },
  { feed: "metro", mode: "metro" },
  { feed: "lightrail", mode: "light_rail" },
  { feed: "ferries", mode: "ferry" },
  { feed: "buses", mode: "bus" },
  { feed: "nswtrains", mode: "train" },
];

const ROUTE_FROM_GTFS = /^(T\d+|M\d+|L\d+|F\d+|CCN|BMT|SCO|SHL|HUN|BMT|SDD)/i;

/** Show current trackwork and planned windows up to ~8 weeks ahead. */
const PLANNED_HORIZON_MS = 56 * 24 * 60 * 60 * 1000;

function stripHtml(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickTranslation(field) {
  const list = field?.translation || [];
  const plain = list.find((t) => t?.text && !/<[a-z]/i.test(t.text));
  return (plain?.text || list[0]?.text || "").trim();
}

function routeFromGtfsId(routeId) {
  if (!routeId) return null;
  const m = String(routeId).match(ROUTE_FROM_GTFS);
  return m ? m[1].toUpperCase() : null;
}

function extractAffectedRoutes(informedEntity = []) {
  const routes = new Set();
  for (const ent of informedEntity) {
    const r = routeFromGtfsId(ent.routeId);
    if (r) routes.add(r);
  }
  return [...routes];
}

function isGtfsAlertRelevant(alert, nowMs = Date.now()) {
  const periods = alert?.activePeriod || [];
  if (!periods.length) return true;

  return periods.some((p) => {
    const start = Number(p.start) * 1000;
    const end = p.end ? Number(p.end) * 1000 : null;
    if (Number.isFinite(start) && start > nowMs + PLANNED_HORIZON_MS) return false;
    if (Number.isFinite(end) && end < nowMs - 2 * 60 * 60 * 1000) return false;
    return true;
  });
}

function inferGtfsSeverity(alert, title, description) {
  const blob = `${title} ${description}`.toLowerCase();
  const cause = String(alert?.cause || "").toUpperCase();
  const effect = String(alert?.effect || "").toUpperCase();

  if (
    /cancel|suspended|no trains|not stopping|major delay|significant delay|avoid travel/i.test(blob)
  ) {
    return "critical";
  }
  if (
    cause === "MAINTENANCE" ||
    /trackwork|planned maintenance|buses replace|replacement bus|changed timetable/i.test(blob)
  ) {
    return "warning";
  }
  if (effect === "MODIFIED_SERVICE" || /delay|late|divert|altered/i.test(blob)) {
    return "warning";
  }
  return "info";
}

function isTrackworkAlert(alert, title, description) {
  const cause = String(alert?.cause || "").toUpperCase();
  const blob = `${title} ${description}`.toLowerCase();
  return (
    cause === "MAINTENANCE" ||
    /trackwork|planned maintenance|buses replace trains|replacement bus/i.test(blob)
  );
}

function mapGtfsEntity(entity, defaultMode) {
  const alert = entity?.alert;
  if (!alert) return null;
  if (!isGtfsAlertRelevant(alert)) return null;

  const titleRaw = pickTranslation(alert.headerText) || "Service alert";
  const descriptionRaw =
    pickTranslation(alert.descriptionText) || titleRaw;
  const title = stripHtml(titleRaw).slice(0, 200) || "Service alert";
  const description = stripHtml(descriptionRaw).slice(0, 4000) || title;

  if (isResolvedAlertText(title, description)) return null;

  const trackwork = isTrackworkAlert(alert, title, description);
  const displayTitle = trackwork && !/trackwork/i.test(title) ? `Trackwork: ${title}` : title;

  const url = pickTranslation(alert.url) || null;
  const affectedRoutes = extractAffectedRoutes(alert.informedEntity);
  const severity = inferGtfsSeverity(alert, displayTitle, description);

  const descWithLink =
    url && !description.includes("transportnsw.info")
      ? `${description}\n\nDetails: ${url}`
      : description;

  return {
    id: `gtfs_rt_${entity.id}`,
    mode: defaultMode,
    title: displayTitle,
    description: descWithLink,
    severity,
    affectedRoutes,
    affectedLine: affectedRoutes[0] ?? "",
    updatedAt: new Date().toISOString(),
    source: "transportnsw-gtfs",
    url: url?.startsWith("http") ? url : null,
    priority: trackwork ? "high" : "normal",
    announcementType: trackwork ? "trackwork" : null,
    status: "active",
  };
}

async function fetchFeedAlerts(apiKey, feed, mode) {
  const url = `https://api.transport.nsw.gov.au/v2/gtfs/alerts/${feed}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `apikey ${apiKey}`,
      Accept: "application/x-protobuf",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`GTFS alerts ${feed} ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  const entities = feedMessage?.entity || [];

  return entities.map((entity) => mapGtfsEntity(entity, mode)).filter(Boolean);
}

/**
 * Live service + trackwork alerts from Transport NSW GTFS-Realtime (transportnsw.info source).
 */
export async function fetchTransportNswGtfsAlerts(apiKey) {
  if (!apiKey?.trim()) return [];

  const batches = await Promise.allSettled(
    GTFS_ALERT_MODES.map(({ feed, mode }) => fetchFeedAlerts(apiKey, feed, mode))
  );

  const merged = [];
  const seen = new Set();

  for (const result of batches) {
    if (result.status !== "fulfilled") {
      console.warn("[GTFS alerts]", result.reason?.message || result.reason);
      continue;
    }
    for (const alert of result.value) {
      if (seen.has(alert.id)) continue;
      seen.add(alert.id);
      merged.push(alert);
    }
  }

  return merged.sort((a, b) => {
    const trackA = /trackwork/i.test(a.title) ? 0 : 1;
    const trackB = /trackwork/i.test(b.title) ? 0 : 1;
    if (trackA !== trackB) return trackA - trackB;
    const rank = { critical: 0, warning: 1, info: 2 };
    return (rank[a.severity] ?? 2) - (rank[b.severity] ?? 2);
  });
}
