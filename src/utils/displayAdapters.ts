/** Convert live backend models (Departure / TripItinerary / ServiceAlert) into
 *  the display shapes the redesigned screens render. */

import type { Departure, ServiceAlert, TripItinerary } from "../services/tfnsw";
import type { JourneyRoute, SampleAlert, SampleDeparture, Severity } from "../constants/sampleData";
import { formatClock, formatTripClock, minutesUntil, parseTfnswTime } from "./tfnswTime";
import { legModeLabel } from "./tripDisplay";
import { trainOnlyTripSummary, transitLegs } from "./tripLegs";

export { formatClock };

function asDate(value: string | Date | number | null | undefined): Date {
  if (value instanceof Date) return value;
  return parseTfnswTime(value);
}

function shortStop(name: string): string {
  return name
    .replace(/\s+Station$/i, "")
    .replace(/,\s*Sydney$/i, "")
    .replace(/\s+(Metro|Light Rail|Wharf)$/i, "")
    .trim();
}

/** Strip a leading station code prefix from a platform value ("CE19" → "19"). */
function cleanPlatform(platform?: string): string {
  if (!platform) return "—";
  const m = platform.match(/(\d+[A-Za-z]?)$/);
  return m ? m[1] : platform;
}

export function departureToDisplay(d: Departure, index = 0): SampleDeparture {
  const when = asDate(d.realTime ?? d.departureTime ?? d.scheduledTime);
  const via =
    d.stops && d.stops.length > 2
      ? d.stops
          .slice(1, 3)
          .map((s) => shortStop(s.station_name))
          .filter(Boolean)
          .join(", ")
      : undefined;
  return {
    id: `${d.routeNumber}-${d.platform}-${when.getTime()}-${index}`,
    route: d.routeNumber,
    destination: shortStop(d.destination),
    platform: cleanPlatform(d.platform),
    via,
    minutes: minutesUntil(when),
    clock: formatClock(when),
    departsAt: when.toISOString(),
    delayed: d.delayMinutes && d.delayMinutes > 0 ? d.delayMinutes : undefined,
    lineColor: d.lineColor,
  };
}

export function departuresToDisplay(list: Departure[]): SampleDeparture[] {
  return list
    .map((d, i) => departureToDisplay(d, i))
    .sort((a, b) => a.minutes - b.minutes || (a.clock ?? "").localeCompare(b.clock ?? ""));
}

/** Rough Adult Opal fare estimate by trip duration (no fare in the API). */
function estimateFare(durationMin: number): string {
  if (durationMin <= 10) return "$3.79";
  if (durationMin <= 20) return "$4.71";
  if (durationMin <= 35) return "$5.42";
  return "$6.06";
}

export function tripToDisplay(
  t: TripItinerary,
  fastest: boolean,
  options?: { showWalkLegs?: boolean }
): JourneyRoute {
  const trainSummary = trainOnlyTripSummary(t.legs, {
    includeWalk: options?.showWalkLegs,
  });
  const dep = trainSummary.departure ?? asDate(t.departureTime);
  const arr = trainSummary.arrival ?? asDate(t.arrivalTime);
  const durationMin = trainSummary.durationMin || t.duration;
  const transfers =
    trainSummary.transfers > 0
      ? trainSummary.transfers
      : (t.transfersCount ?? Math.max(0, transitLegs(t.legs).length - 1));

  const chips = transitLegs(t.legs).map((leg) => ({
    mode: leg.mode,
    route: leg.routeNumber || leg.mode.toUpperCase(),
  }));

  const steps = trainSummary.legs.map((leg) => {
    const dest = leg.destinationName ? shortStop(leg.destinationName) : "destination";
    const legDep = asDate(leg.departure);
    const legArr = asDate(leg.arrival);
    if (leg.mode === "walk") {
      return {
        mode: "walk",
        label: `Walk to ${dest}`,
        detail: `${formatClock(legDep)} – ${formatClock(legArr)} · ${leg.duration} min`,
      };
    }
    const route = leg.routeNumber || leg.mode.toUpperCase();
    const platform = leg.platform ? ` · Platform ${cleanPlatform(leg.platform)}` : "";
    return {
      mode: leg.mode,
      route,
      label: `${legModeLabel(leg.mode, route)} to ${dest}`,
      detail: `Board ${formatClock(legDep)} · Arrive ${formatClock(legArr)} · ${leg.duration} min${platform}`,
    };
  });

  const leaveInMinutes = Math.round((dep.getTime() - Date.now()) / 60000);
  const nowMs = Date.now();
  const isPast = arr.getTime() < nowMs;

  return {
    id: t.id,
    durationMin,
    leaveInMinutes,
    isPast,
    isLive: t.isLive === true,
    departureIso: dep.toISOString(),
    arrivalIso: arr.toISOString(),
    fastest,
    changes: transfers === 0 ? "No changes" : `${transfers} change${transfers > 1 ? "s" : ""}`,
    depart: formatTripClock(dep),
    arrive: formatTripClock(arr),
    fare: estimateFare(durationMin),
    chips,
    steps,
    itinerary: t,
  };
}

export function tripsToDisplay(
  list: TripItinerary[],
  options?: { showWalkLegs?: boolean }
): JourneyRoute[] {
  if (list.length === 0) return [];
  const trainDurations = list.map((t) => trainOnlyTripSummary(t.legs).durationMin || t.duration);
  const fastest = Math.min(...trainDurations);

  const displayed = list.map((t, i) => tripToDisplay(t, trainDurations[i] === fastest, options));

  // React list keys must be unique. Backends can sometimes emit duplicate itinerary ids
  // (e.g. merged timetable + live trips). Ensure uniqueness deterministically.
  const counts = new Map<string, number>();
  for (const r of displayed) {
    const base = r.id;
    const n = counts.get(base) ?? 0;
    if (n > 0) r.id = `${base}__${n}`;
    counts.set(base, n + 1);
  }

  return displayed.sort((a, b) => {
    const aPast = !!a.isPast;
    const bPast = !!b.isPast;
    if (aPast !== bPast) return aPast ? 1 : -1; // upcoming first, earlier trips later
    return (a.leaveInMinutes ?? 0) - (b.leaveInMinutes ?? 0);
  });
}

const LINE_RE = /\b(T\d+|M\d+|L\d+|F\d+)\b/i;

const MODE_LABEL: Record<string, string> = {
  train: "Train",
  metro: "Metro",
  bus: "Bus",
  light_rail: "Light Rail",
  ferry: "Ferry",
};

export function alertToDisplay(a: ServiceAlert): SampleAlert {
  const joined = `${a.affectedRoutes.join(" ")} ${a.title} ${a.description}`;
  const match = joined.match(LINE_RE);
  const route = match ? match[1].toUpperCase() : (MODE_LABEL[a.mode] ?? "Info");
  const lineName = a.affectedRoutes[0] ?? MODE_LABEL[a.mode] ?? "";
  return {
    id: a.id,
    severity: a.severity as Severity,
    route,
    lineName,
    title: a.title,
    description: a.description,
    time: "",
  };
}

export function alertsToDisplay(list: ServiceAlert[]): SampleAlert[] {
  return list.map(alertToDisplay);
}
