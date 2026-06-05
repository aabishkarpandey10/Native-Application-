import { parseTfnswTime } from "./tfnswTime.js";
import { estimateServiceEndMs } from "./timedStopSequence.js";

const PAST_DEPART_GRACE_MS = 90_000;

/** Last stop time for a service, or estimated end from timetable path. */
export function serviceEndMs(departure, stops, stationId, row) {
  if (stops?.length >= 2) {
    const last = stops[stops.length - 1];
    const t = parseTfnswTime(last.time ?? last.stop_time).getTime();
    if (Number.isFinite(t)) return t;
  }
  const dep =
    departure instanceof Date ? departure : parseTfnswTime(departure);
  if (row && stationId) {
    return estimateServiceEndMs(stationId, row, dep);
  }
  return dep.getTime() + 45 * 60_000;
}

/**
 * Keep upcoming departures and services still running (until terminus).
 * Matches Transport NSW boards that show in-progress trips.
 */
export function filterActiveDepartures(list, now = new Date(), options = {}) {
  const { stationId, rowsByKey, fullDay } = options;
  const nowMs = now.getTime();

  if (fullDay) {
    return list.filter((d) => {
      const depMs = parseTfnswTime(d.realTime ?? d.scheduledTime).getTime();
      return depMs >= nowMs - PAST_DEPART_GRACE_MS;
    });
  }

  return list.filter((d) => {
    const depMs = parseTfnswTime(d.realTime ?? d.scheduledTime).getTime();
    const row =
      rowsByKey?.get(`${d.routeNumber}|${d.destination}|${depMs}`) ?? null;
    const endMs = serviceEndMs(
      d.scheduledTime ?? d.realTime,
      d.stops,
      stationId,
      row
    );
    if (endMs >= nowMs - 60_000) return true;
    return depMs >= nowMs - PAST_DEPART_GRACE_MS;
  });
}
