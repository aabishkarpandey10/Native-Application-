import type { TripLeg } from "../services/tfnsw";

function cleanStopName(name: string) {
  return name
    .replace(/, Sydney.*$/i, "")
    .replace(/\s+Station$/i, "")
    .replace(/\s*,\s*Stand\s+[A-Z0-9]+.*$/i, "")
    .replace(/\s*,\s*Platform\s+\d+.*$/i, "")
    .trim();
}

/** Spread leg stop names across departure → arrival for a readable timetable. */
export function buildLegTimetable(leg: TripLeg): Array<{ name: string; time: Date }> {
  if (leg.stopTimes && leg.stopTimes.length > 0) {
    const exact = leg.stopTimes
      .map((st) => ({ name: cleanStopName(st.station_name), time: st.time }))
      .filter((st) => st.name)
      .filter((st, i, arr) => arr.findIndex((x) => x.name === st.name) === i);
    if (exact.length > 0) return exact;
  }

  const names = (leg.stops || [])
    .map(cleanStopName)
    .filter((n, i, arr) => n && arr.indexOf(n) === i);

  if (names.length === 0) {
    const from = leg.originName ? cleanStopName(leg.originName) : "";
    const to = leg.destinationName ? cleanStopName(leg.destinationName) : "";
    if (from) names.push(from);
    if (to && to !== from) names.push(to);
  }

  if (names.length === 0) return [];

  const startMs = leg.departure.getTime();
  const endMs = leg.arrival.getTime();
  const span = Math.max(endMs - startMs, 60000);

  return names.map((name, index) => ({
    name,
    time: new Date(startMs + (index / Math.max(1, names.length - 1)) * span),
  }));
}

export function waitMinutesBetween(prev: TripLeg, next: TripLeg): number {
  const gap = next.departure.getTime() - prev.arrival.getTime();
  return Math.max(0, Math.round(gap / 60000));
}
