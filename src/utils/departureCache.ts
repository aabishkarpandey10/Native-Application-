import { getLinesForStation } from "../constants/trainNetworks";
import { SYDNEY_STATIONS } from "../constants/stations";
import { parseTfnswTime } from "./tfnswTime";

/** Detect old caches where every train departure was tagged T1 despite multiple lines at the stop. */
export function trainDeparturesLookStale(
  stationId: string,
  departures: Array<{ route_number?: string; routeNumber?: string; mode?: string }>
): boolean {
  const station = SYDNEY_STATIONS.find((s) => s.id === stationId);
  if (station?.mode !== "train" || departures.length < 2) return false;

  const routes = new Set(
    departures
      .map((d) => String(d.route_number ?? d.routeNumber ?? "").toUpperCase())
      .filter(Boolean)
  );
  if (routes.size !== 1) return false;

  const only = [...routes][0];
  const linesAtStop = getLinesForStation(stationId);
  if (linesAtStop.length <= 2) return false;

  return only === "T1" && linesAtStop.some((l) => l.route !== "T1");
}

/** Refresh when the earliest scheduled departure is more than 2 minutes in the past. */
export function departuresLookTimeStale(
  departures: Array<{
    scheduled_time?: string;
    scheduledTime?: string;
    delay_minutes?: number;
    delayMinutes?: number;
  }>,
  graceMinutes = 2
): boolean {
  if (departures.length === 0) return false;

  const now = Date.now();
  const graceMs = graceMinutes * 60000;

  for (const dep of departures) {
    const raw = dep.scheduled_time ?? dep.scheduledTime;
    if (!raw) continue;
    const sched = parseTfnswTime(raw);
    const delay = Number(dep.delay_minutes ?? dep.delayMinutes ?? 0) || 0;
    const effective = sched.getTime() + delay * 60000;
    if (effective >= now - graceMs) return false;
  }

  return true;
}
