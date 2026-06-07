import { STATION_BY_ID, getLinesForStation } from "./trainNetworkData.js";
import { findBranchPath } from "./trainNetworkPath.js";
import { buildLineStopSequence } from "./stopSequence.js";
import { parseTfnswTime, toIsoString } from "./tfnswTime.js";

/**
 * Find the shortest same-branch train path between two stations (no transfers).
 */
export function findDirectTrainConnection(originId, destId) {
  const path = findBranchPath(originId, destId, null);
  if (!path) return null;
  return {
    route: path.route,
    branchId: path.branchId,
    hopCount: path.hopCount,
    stationIds: path.stationIds,
  };
}

function durationFromStopTimes(stopTimes, fallbackMinutes) {
  if (!stopTimes || stopTimes.length < 2) return fallbackMinutes;
  const dep = parseTfnswTime(stopTimes[0].time);
  const arr = parseTfnswTime(stopTimes[stopTimes.length - 1].time);
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return fallbackMinutes;
  return Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
}

function arrivalFromStopTimes(stopTimes, fallbackDate) {
  if (stopTimes?.length >= 2) {
    return parseTfnswTime(stopTimes[stopTimes.length - 1].time);
  }
  return fallbackDate instanceof Date ? fallbackDate : parseTfnswTime(fallbackDate);
}

/** Align trip + leg times with stopTimes and first/last leg boundaries. */
export function normalizeItineraryTimes(itinerary) {
  if (!itinerary?.legs?.length) return itinerary;

  const legs = itinerary.legs.map((leg) => {
    let dep = parseTfnswTime(leg.departureTime);
    let arr = parseTfnswTime(leg.arrivalTime);
    if (leg.stopTimes?.length >= 2) {
      dep = parseTfnswTime(leg.stopTimes[0].time);
      arr = parseTfnswTime(leg.stopTimes[leg.stopTimes.length - 1].time);
    }
    if (arr.getTime() <= dep.getTime()) {
      const fallback = leg.durationMinutes || 1;
      arr = new Date(dep.getTime() + fallback * 60000);
    }
    const durationMinutes = Math.max(
      1,
      Math.round((arr.getTime() - dep.getTime()) / 60000)
    );
    return {
      ...leg,
      departureTime: toIsoString(dep),
      arrivalTime: toIsoString(arr),
      durationMinutes,
    };
  });

  const first = legs[0];
  const last = legs[legs.length - 1];
  const tripDep = parseTfnswTime(first.departureTime);
  const tripArr = parseTfnswTime(last.arrivalTime);
  const totalDurationMinutes = Math.max(
    1,
    Math.round((tripArr.getTime() - tripDep.getTime()) / 60000)
  );

  return {
    ...itinerary,
    legs,
    departureTime: first.departureTime,
    arrivalTime: last.arrivalTime,
    totalDurationMinutes,
  };
}

export function buildDirectTrainItinerary(origin, dest, departDate, connection) {
  const lineRoute = connection?.route || getLinesForStation(origin.id)[0] || "T2";
  const departureTime = departDate instanceof Date ? departDate : new Date(departDate);
  const perStop = 4;

  const lineStops = buildLineStopSequence({
    originStationId: origin.id,
    destinationLabel: dest.name.replace(/ Station$/, ""),
    lineRoute,
    schedTime: departureTime,
    minutesPerStop: perStop,
  });

  const stopNames =
    lineStops.length >= 2
      ? lineStops.map((s) => s.station_name)
      : [origin.name, dest.name];

  const duration =
    lineStops.length >= 2
      ? durationFromStopTimes(lineStops, (lineStops.length - 1) * perStop)
      : Math.max(12, (connection?.hopCount || 2) * perStop);

  const arrivalTime = new Date(departureTime.getTime() + duration * 60000);

  const leg = {
    mode: "train",
    originName: origin.name,
    destinationName: dest.name,
    originId: origin.id,
    destinationId: dest.id,
    departureTime: toIsoString(departureTime),
    arrivalTime: toIsoString(arrivalTime),
    durationMinutes: duration,
    platform: "Platform 1",
    routeNumber: lineRoute,
    stops: stopNames,
  };

  return {
    id: `direct_train_${origin.id}_${dest.id}_${departureTime.getTime()}`,
    totalDurationMinutes: duration,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
    legs: [leg],
    transfersCount: 0,
    _directTrain: true,
  };
}

function transitLegs(itinerary) {
  return (itinerary.legs || []).filter((l) => l.mode !== "walk");
}

function passesThroughCentral(itinerary) {
  return (itinerary.legs || []).some((leg) => {
    const text = [leg.originName, leg.destinationName, ...(leg.stops || [])]
      .join(" ")
      .toLowerCase();
    return /\bcentral\b/.test(text);
  });
}

function isWesternStation(station) {
  if (!station) return false;
  const lon = station.lon ?? station.longitude;
  return lon != null && lon < 151.05;
}

function scoreItinerary(itinerary, origin, dest, directConn) {
  let score = itinerary.totalDurationMinutes ?? 999;
  const transits = transitLegs(itinerary);

  score += Math.max(0, transits.length - 1) * 10;
  const originMode = origin?.mode === "lightrail" ? "light_rail" : origin?.mode;
  const destMode = dest?.mode === "lightrail" ? "light_rail" : dest?.mode;
  const busTrip = originMode === "bus" || destMode === "bus";
  if (busTrip) {
    if (!hasBusLeg(itinerary)) score += 45;
    else score -= 20;
  } else {
    score += transits.filter((l) => l.mode === "bus").length * 30;
  }

  const bothWestern = isWesternStation(origin) && isWesternStation(dest);
  if (bothWestern && directConn && passesThroughCentral(itinerary)) {
    score += 50;
  }

  if (itinerary._directTrain) score -= 25;

  if (transits.length === 1 && transits[0].mode === "train") {
    score -= 20;
  }

  const trainLegs = transits.filter((l) => l.mode === "train");
  if (trainLegs.length === 1 && transits.length <= 3) {
    score -= 15;
  }

  return score;
}

export function rankItineraries(itineraries, origin, dest) {
  const directConn = findDirectTrainConnection(origin?.id, dest?.id);
  return [...itineraries]
    .sort(
      (a, b) =>
        scoreItinerary(a, origin, dest, directConn) - scoreItinerary(b, origin, dest, directConn)
    )
    .map(({ _directTrain, ...rest }) => rest);
}

function isTrainOnly(itinerary) {
  const transits = transitLegs(itinerary);
  return transits.length > 0 && transits.every((l) => l.mode === "train");
}

function isLightRailOnly(itinerary) {
  const transits = transitLegs(itinerary);
  return transits.length > 0 && transits.every((l) => l.mode === "light_rail");
}

function hasBusLeg(itinerary) {
  return (itinerary.legs || []).some((l) => l.mode === "bus");
}

/** Signature used to drop duplicate itineraries (same modes + departure + arrival). */
function itinerarySignature(itinerary) {
  const modes = (itinerary.legs || [])
    .filter((l) => l.mode !== "walk")
    .map((l) => `${l.mode}:${l.routeNumber || ""}`)
    .join(">");
  return `${modes}|${itinerary.departureTime}|${itinerary.arrivalTime}`;
}

/**
 * When a direct train-only journey is possible (e.g. both stations on one line),
 * hide bus-based alternatives so the options aren't confusing.
 */
export function filterRedundantModes(itineraries, origin, dest) {
  const originMode = origin?.mode === "lightrail" ? "light_rail" : origin?.mode;
  const destMode = dest?.mode === "lightrail" ? "light_rail" : dest?.mode;

  if (originMode === "train" && destMode === "train") {
    const trainOnlyExists = itineraries.some(isTrainOnly);
    if (!trainOnlyExists) return itineraries;

    const filtered = itineraries.filter((it) => !hasBusLeg(it));
    return filtered.length > 0 ? filtered : itineraries;
  }

  if (originMode === "light_rail" && destMode === "light_rail") {
    const lightRailOnlyExists = itineraries.some(isLightRailOnly);
    if (lightRailOnlyExists) {
      const filtered = itineraries.filter((it) => !hasBusLeg(it));
      return filtered.length > 0 ? filtered : itineraries;
    }

    // Even when no pure LR itinerary is present, hide bus-only options for LR↔LR.
    const withLightRail = itineraries.filter((it) =>
      transitLegs(it).some((leg) => leg.mode === "light_rail")
    );
    return withLightRail.length > 0 ? withLightRail : itineraries;
  }

  if (originMode === "bus" || destMode === "bus") {
    const withBus = itineraries.filter((it) => hasBusLeg(it));
    return withBus.length > 0 ? withBus : itineraries;
  }

  return itineraries;
}

function isImplausibleTrainItinerary(itinerary) {
  if (itinerary._directTrain || String(itinerary.id || "").startsWith("direct_train_")) {
    return true;
  }
  const transits = transitLegs(itinerary);
  const trainLegs = transits.filter((l) => l.mode === "train");
  if (!trainLegs.length) return false;

  const dep = new Date(itinerary.departureTime).getTime();
  const arr = new Date(itinerary.arrivalTime).getTime();
  const totalMin =
    itinerary.totalDurationMinutes ??
    Math.max(0, Math.round((arr - dep) / 60000));

  const stopCount = trainLegs.reduce((n, leg) => Math.max(n, leg.stops?.length || 0), 0);
  if (stopCount >= 4 && totalMin < 8) return true;
  if (stopCount >= 2 && totalMin < 4) return true;
  return false;
}

/** Prefer TfNSW live trips; add PDF timetable only for past services or when live is empty. */
export function mergeLiveAndTimetableTrips(liveTrips, timetableTrips, { includePast = false } = {}) {
  const live = (liveTrips || []).map((it) => ({ ...it, isLive: true }));
  const timetable = (timetableTrips || []).map((it) => ({
    ...it,
    isLive: false,
  }));

  if (!live.length) return timetable.map(normalizeItineraryTimes);
  if (!timetable.length) return live.map(normalizeItineraryTimes);

  const now = Date.now();
  const liveDepartureMs = new Set(
    live.map((it) => parseTfnswTime(it.departureTime).getTime())
  );

  const timetableExtras = timetable.filter((it) => {
    if (isImplausibleTrainItinerary(it)) return false;
    const depMs = parseTfnswTime(it.departureTime).getTime();
    if (!includePast && depMs < now - 3 * 60_000) return false;
    if (includePast) {
      const legs = it.legs || [];
      const lastLeg = legs[legs.length - 1];
      const arrMs = lastLeg?.arrivalTime
        ? parseTfnswTime(lastLeg.arrivalTime).getTime()
        : parseTfnswTime(it.arrivalTime).getTime();
      if (arrMs < now - 5 * 60_000) return false;
    }
    for (const liveMs of liveDepartureMs) {
      if (Math.abs(depMs - liveMs) < 5 * 60_000) return false;
    }
    return true;
  });

  const merged = [...live, ...timetableExtras].map(normalizeItineraryTimes);
  return merged.sort(
    (a, b) =>
      parseTfnswTime(a.departureTime).getTime() - parseTfnswTime(b.departureTime).getTime()
  );
}

/** Fast path for imported timetables — dedupe by departure minute only. */
export function finalizeTimetableItineraries(itineraries) {
  const seen = new Set();
  return (itineraries || [])
    .map(normalizeItineraryTimes)
    .filter((it) => !isImplausibleTrainItinerary(it))
    .filter((it) => {
      const depMs = parseTfnswTime(it.departureTime).getTime();
      if (seen.has(depMs)) return false;
      seen.add(depMs);
      return true;
    })
    .sort(
      (a, b) =>
        parseTfnswTime(a.departureTime).getTime() - parseTfnswTime(b.departureTime).getTime()
    );
}

/** Rank, de-duplicate, drop confusing alternatives, then list as a timetable. */
export function finalizeItineraries(itineraries, origin, dest) {
  const plausible = (itineraries || [])
    .map(normalizeItineraryTimes)
    .filter((it) => !isImplausibleTrainItinerary(it));
  const ranked = rankItineraries(plausible, origin, dest);

  const seen = new Set();
  const deduped = ranked.filter((it) => {
    const sig = itinerarySignature(it);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });

  const filtered = filterRedundantModes(deduped, origin, dest);

  // Present like a timetable: sorted by departure time (soonest first).
  return filtered.sort(
    (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
  );
}

function normalizeStationLabel(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/\s+station$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function labelMatches(label, stationName) {
  const a = normalizeStationLabel(label);
  const b = normalizeStationLabel(stationName);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

export function hasDirectTrainItinerary(itineraries, origin, dest) {
  return itineraries.some((it) => {
    const trains = transitLegs(it).filter((l) => l.mode === "train");
    if (trains.length !== 1) return false;

    const leg = trains[0];
    const fromOk =
      labelMatches(leg.originName, origin?.name) ||
      labelMatches(leg.stops?.[0], origin?.name);
    const toOk =
      labelMatches(leg.destinationName, dest?.name) ||
      labelMatches(leg.stops?.[leg.stops.length - 1], dest?.name);

    return fromOk && toOk;
  });
}

/**
 * TfNSW coordinate-based trip planning adds short first/last "access" bus legs
 * that simply connect a nearby address to the chosen station. When the endpoint
 * is a train station, treat those connector legs as walking so the journey reads
 * as a clean train trip instead of bus → train → bus.
 */
export function reclassifyAccessLegs(itinerary, origin, dest) {
  const legs = itinerary.legs || [];
  if (legs.length < 2) return itinerary;

  const updated = legs.map((leg, idx) => {
    if (leg.mode !== "bus") return leg;
    const isFirst = idx === 0;
    const isLast = idx === legs.length - 1;
    if (!isFirst && !isLast) return leg;

    // First leg connects an address to the origin station; last leg connects the
    // destination station to an address. Either way it's just access to/from a
    // train station the user explicitly chose, so present it as walking.
    const touchesStation = isFirst
      ? origin?.mode === "train" && labelMatches(leg.destinationName, origin?.name)
      : dest?.mode === "train" && labelMatches(leg.originName, dest?.name);

    if (origin?.mode === "bus" && isFirst) return leg;
    if (dest?.mode === "bus" && isLast) return leg;

    if (touchesStation) {
      return { ...leg, mode: "walk", routeNumber: "" };
    }
    return leg;
  });

  return { ...itinerary, legs: updated };
}

export function enrichItinerariesWithDirectTrain(itineraries, origin, dest, _departDate) {
  // Synthetic "direct" trips used 3 min/stop from "now" and duplicated live/timetable
  // results. Real trips come from TfNSW live API and imported PDF timetables.
  void origin;
  void dest;
  return itineraries || [];
}

export function buildTripEndpointParams(station, stopId) {
  const lat = station.lat ?? station.latitude;
  const lon = station.lon ?? station.longitude;
  const resolvedStop = stopId || station.tfnswStopId || station.id;
  // Bus/light-rail/ferry: TfNSW stop IDs return real stop sequences and times.
  if (station.mode === "bus" && resolvedStop) {
    return { type: "stop", name: String(resolvedStop) };
  }
  if (
    (station.mode === "lightrail" || station.mode === "light_rail" || station.mode === "ferry") &&
    resolvedStop
  ) {
    return { type: "stop", name: String(resolvedStop) };
  }
  // Coordinates anchor train trip planning to the station location more reliably than parent stop IDs.
  if (station.mode === "train" && lat != null && lon != null) {
    return { type: "coord", name: `${lon}:${lat}:EPSG:4326` };
  }
  if (stopId) {
    return { type: "stop", name: stopId };
  }
  if (lat != null && lon != null) {
    return { type: "coord", name: `${lon}:${lat}:EPSG:4326` };
  }
  return { type: "any", name: stopId || station.id };
}
