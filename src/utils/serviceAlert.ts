import type { ServiceAlert } from "../services/tfnsw";

const VALID_MODES = new Set<ServiceAlert["mode"]>([
  "train",
  "metro",
  "bus",
  "light_rail",
  "ferry",
]);

const VALID_SEVERITY = new Set<ServiceAlert["severity"]>(["critical", "warning", "info"]);

const TRACKWORK_BLOB =
  /\b(track\s*work|trackwork|planned maintenance|rail maintenance|weekend work|rail repair|buses replace trains?|replacement buses?|replacement bus|changed timetable|rail replacement|station upgrade|line closure|maintenance work)\b/i;

const CRITICAL_BLOB =
  /\b(cancel+ed|suspended|not stopping|major delay|significant delay|signal failure|power failure|emergency|evacuat|avoid travel|no trains|detour|significant delays|service disruption|services suspended)\b/i;

export function normalizeAlertMode(mode: unknown): ServiceAlert["mode"] {
  const raw = String(mode ?? "train")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (raw === "lightrail") return "light_rail";
  if (VALID_MODES.has(raw as ServiceAlert["mode"])) return raw as ServiceAlert["mode"];
  return "train";
}

export function normalizeAlertSeverity(severity: unknown): ServiceAlert["severity"] {
  const s = String(severity ?? "info").toLowerCase();
  if (VALID_SEVERITY.has(s as ServiceAlert["severity"])) {
    return s as ServiceAlert["severity"];
  }
  return "info";
}

const RESOLVED_TEXT =
  /\b(issue\s+resolved|has\s+been\s+resolved|disruption\s+ended|lifted|cleared|no\s+longer\s+applies|services\s+have\s+resumed|has\s+resumed)\b/i;

const GOOD_SERVICE_ONLY = /\bgood\s+service\b/i;

const ACTIVE_DISRUPTION =
  /\b(delay|late|trackwork|cancel|suspended|disruption|divert|replacement\s+bus|not\s+stopping)\b/i;

export function isActiveServiceAlert(title: string, description: string): boolean {
  const blob = `${title} ${description}`;
  if (/\bresolved\b/i.test(blob) && !/\bunresolved\b/i.test(blob)) return false;
  if (RESOLVED_TEXT.test(blob)) return false;
  if (GOOD_SERVICE_ONLY.test(blob) && !ACTIVE_DISRUPTION.test(blob)) return false;
  return true;
}

export function isTrackworkAlert(alert: Pick<ServiceAlert, "title" | "description" | "announcementType" | "isTrackwork">): boolean {
  if (alert.isTrackwork === true) return true;
  const announcement = String(alert.announcementType ?? "").toLowerCase();
  if (announcement === "trackwork") return true;
  const blob = `${alert.title} ${alert.description}`;
  return TRACKWORK_BLOB.test(blob);
}

export function isCriticalAlert(
  alert: Pick<ServiceAlert, "title" | "description" | "severity" | "announcementType" | "isTrackwork" | "isCritical">
): boolean {
  if (alert.isCritical === true) return true;
  if (isTrackworkAlert(alert)) return false;
  if (alert.severity === "critical") return true;
  const blob = `${alert.title} ${alert.description}`;
  return CRITICAL_BLOB.test(blob);
}

export function formatAlertRelativeTime(updatedAt?: string): string {
  if (!updatedAt) return "";
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return "";
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function mapRawAlert(item: Record<string, unknown>): ServiceAlert | null {
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  if (item.status === "resolved" || item.resolved === true) return null;

  const affected =
    item.affectedRoutes ??
    item.affected_routes ??
    (item.affectedLine ? [item.affectedLine] : []);

  const title = String(item.title ?? "Service alert").trim() || "Service alert";
  const description = String(item.description ?? title).trim() || title;

  if (!isActiveServiceAlert(title, description)) return null;

  const mapped: ServiceAlert = {
    id,
    mode: normalizeAlertMode(item.mode),
    title,
    description,
    severity: normalizeAlertSeverity(item.severity),
    affectedRoutes: Array.isArray(affected)
      ? affected.map(String).filter(Boolean)
      : [String(affected)].filter(Boolean),
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
    announcementType: item.announcementType != null ? String(item.announcementType) : null,
    isTrackwork: item.isTrackwork === true ? true : undefined,
    isCritical: item.isCritical === true ? true : undefined,
    url: item.url != null ? String(item.url) : null,
  };

  if (mapped.isTrackwork == null) {
    mapped.isTrackwork = isTrackworkAlert(mapped);
  }
  if (mapped.isCritical == null) {
    mapped.isCritical = isCriticalAlert(mapped);
  }

  return mapped;
}

export function dedupeAlerts(alerts: ServiceAlert[]): ServiceAlert[] {
  const seen = new Set<string>();
  const out: ServiceAlert[] = [];
  for (const a of alerts) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
  }
  return out;
}
