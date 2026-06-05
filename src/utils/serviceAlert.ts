import type { ServiceAlert } from "../services/tfnsw";

const VALID_MODES = new Set<ServiceAlert["mode"]>([
  "train",
  "metro",
  "bus",
  "light_rail",
  "ferry",
]);

const VALID_SEVERITY = new Set<ServiceAlert["severity"]>(["critical", "warning", "info"]);

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

  return {
    id,
    mode: normalizeAlertMode(item.mode),
    title,
    description,
    severity: normalizeAlertSeverity(item.severity),
    affectedRoutes: Array.isArray(affected)
      ? affected.map(String).filter(Boolean)
      : [String(affected)].filter(Boolean),
  };
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
