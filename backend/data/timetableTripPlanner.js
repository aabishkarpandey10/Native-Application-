import { BUS_LINE_BRANCHES, BUS_STATION_BY_ID } from "./busNetworkData.js";
import { buildLineStopSequence } from "./stopSequence.js";
import { METRO_LINE_STATION_IDS } from "./metroNetworkData.js";
import { LIGHT_RAIL_LINE_STATION_IDS } from "./sydneyNetworks.js";
import { SYDNEY_STATIONS } from "./sydneyStations.js";
import {
  STATION_BY_ID as TRAIN_STATION_BY_ID,
  TRAIN_LINE_BRANCHES,
} from "./trainNetworkData.js";
import {
  findBranchPath,
  findTrainInterchanges,
  routeLabelsMatch,
  stationsConnectedOnRoute,
} from "./trainNetworkPath.js";
import { normalizeItineraryTimes } from "./tripPlanner.js";
import { parseTfnswTime, toIsoString } from "./tfnswTime.js";
import {
  getActiveScheduledRows,
  getDayScheduleRows,
  getRestOfDayScheduleRows,
  getScheduleRowsForTripPlan,
  getUpcomingScheduledRows,
} from "./customTimetables.js";
import {
  destinationMatches,
  pickTimedStopSequence,
} from "./timedStopSequence.js";

function normalizeName(name) {
  return String(name || "")
    .replace(/\s+Station$/i, "")
    .replace(/,\s*Sydney$/i, "")
    .trim()
    .toLowerCase();
}

function stationRoutes(stationId) {
  const routes = new Set();
  for (const branch of TRAIN_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return [...routes];
}

const ALL_STATIONS = [
  ...SYDNEY_STATIONS,
  ...Object.values(TRAIN_STATION_BY_ID || {}),
  ...Object.values(BUS_STATION_BY_ID || {}),
];

const STATION_NAME_BY_ID = Object.fromEntries(ALL_STATIONS.map((s) => [s.id, s.name]));
const STATION_BY_NORMALIZED_NAME = Object.fromEntries(
  ALL_STATIONS.map((s) => [
    normalizeName(s.name)
      .replace(/\s+light rail stop$/i, "")
      .replace(/\s+light rail$/i, ""),
    s,
  ])
);

function isLightRailStation(station) {
  const mode = station?.mode === "lightrail" ? "light_rail" : station?.mode;
  return mode === "light_rail";
}

function routeForRow(row) {
  return String(row?.routeNumber || "").toUpperCase();
}

function directServingRoutes(origin, dest) {
  const originMode = origin?.mode === "lightrail" ? "light_rail" : origin?.mode;

  if (originMode === "light_rail") {
    return new Set(
      stationRoutes(origin.id).filter(
        (r) => /^L\d/i.test(r) && lightRailPathIdsOnRoute(origin.id, dest.id, r).length >= 2
      )
    );
  }

  if (originMode === "metro") {
    return new Set(
      stationRoutes(origin.id).filter(
        (r) => /^M\d/i.test(r) && metroPathIdsOnRoute(origin.id, dest.id, r).length >= 2
      )
    );
  }

  if (originMode === "bus" || dest?.mode === "bus") {
    const routes = new Set();
    for (const branch of BUS_LINE_BRANCHES) {
      if (busPathIdsOnBranch(origin.id, dest.id, branch.route).length >= 2) {
        routes.add(String(branch.route).toUpperCase());
      }
    }
    return routes;
  }

  return new Set(
    stationRoutes(origin.id).filter(
      (r) =>
        !/^L\d/i.test(r) &&
        (stationsConnectedOnRoute(origin.id, dest.id, r) || findBranchPath(origin.id, dest.id, r))
    )
  );
}

function filterRowsForRoutes(rows, routeSet) {
  if (!routeSet?.size) return rows;
  return rows.filter(({ row }) => {
    const r = routeForRow(row);
    for (const sr of routeSet) {
      if (routeLabelsMatch(r, sr)) return true;
    }
    return false;
  });
}

/** Cached branch lookup — avoids repeated findBranchPath per departure row. */
function buildFastTrainReachResolver(origin, dest) {
  const branchCache = new Map();
  const perStopMin = 4;

  return (row, depTime) => {
    const route = routeForRow(row);
    let branchPath = branchCache.get(route);
    if (branchPath === undefined) {
      branchPath = findBranchPath(origin.id, dest.id, route);
      branchCache.set(route, branchPath);
    }
    if (!branchPath?.stationIds?.length) return { ok: false };

    const displayRoute = routeLabelsMatch(row.routeNumber, branchPath.route)
      ? row.routeNumber
      : branchPath.route;
    const seq = branchPath.stationIds.map((id, i) => ({
      station_name: STATION_NAME_BY_ID[id] || id,
      time: toIsoString(new Date(depTime.getTime() + i * perStopMin * 60_000)),
    }));
    const destLabel = dest.name.replace(/\s+Station$/i, "");
    const lastName = seq[seq.length - 1]?.station_name;
    if (!destinationMatches(lastName, destLabel) && !destinationMatches(lastName, dest.name)) {
      return { ok: false };
    }
    const duration = durationFromStopTimes(seq, (seq.length - 1) * perStopMin);
    return {
      ok: true,
      stops: seq.map((s) => s.station_name),
      stopTimes: seq,
      duration,
      routeNumber: displayRoute,
    };
  };
}

function lightRailPathIdsOnRoute(originId, destId, route) {
  const ids = LIGHT_RAIL_LINE_STATION_IDS[route] || [];
  const from = ids.indexOf(originId);
  const to = ids.indexOf(destId);
  if (from === -1 || to === -1) return [];
  return from <= to ? ids.slice(from, to + 1) : ids.slice(to, from + 1).reverse();
}

function metroPathIdsOnRoute(originId, destId, route) {
  const ids = METRO_LINE_STATION_IDS[route] || [];
  const from = ids.indexOf(originId);
  const to = ids.indexOf(destId);
  if (from === -1 || to === -1) return [];
  return from <= to ? ids.slice(from, to + 1) : ids.slice(to, from + 1).reverse();
}

function busPathIdsOnBranch(originId, destId, routeNumber) {
  for (const branch of BUS_LINE_BRANCHES) {
    if (String(branch.route) !== String(routeNumber)) continue;
    const ids = branch.stationIds || [];
    const from = ids.indexOf(originId);
    const to = ids.indexOf(destId);
    if (from === -1 || to === -1) continue;
    return from <= to ? ids.slice(from, to + 1) : ids.slice(to, from + 1).reverse();
  }
  return [];
}

function legModeForRoute(routeNumber, fallbackMode = "train") {
  const r = String(routeNumber || "").toUpperCase();
  if (/^M\d+/.test(r)) return "metro";
  if (/^L\d+/.test(r)) return "light_rail";
  if (/^\d{1,4}[A-Z]?$/.test(r) || /^B\d/.test(r)) return "bus";
  if (fallbackMode === "lightrail") return "light_rail";
  return fallbackMode || "train";
}

function stationPathIdsOnRoute(originId, destId, route) {
  if (/^L\d+$/i.test(route)) return lightRailPathIdsOnRoute(originId, destId, route);
  return findBranchPath(originId, destId, route)?.stationIds || [];
}

function durationFromStopTimes(stopTimes, fallbackMinutes) {
  if (!stopTimes || stopTimes.length < 2) return fallbackMinutes;
  const dep = parseTfnswTime(stopTimes[0].time);
  const arr = parseTfnswTime(stopTimes[stopTimes.length - 1].time);
  return Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
}

function arrivalFromStopTimes(stopTimes, fallbackDate) {
  if (stopTimes?.length >= 2) {
    return parseTfnswTime(stopTimes[stopTimes.length - 1].time);
  }
  return fallbackDate instanceof Date ? fallbackDate : parseTfnswTime(fallbackDate);
}

function syntheticStopSequence(pathIds, depTime, perStop, routeNumber) {
  const seq = pathIds.map((id, i) => ({
    station_name: STATION_NAME_BY_ID[id] || id,
    time: toIsoString(new Date(depTime.getTime() + i * perStop * 60_000)),
  }));
  const duration = durationFromStopTimes(seq, (seq.length - 1) * perStop);
  return {
    ok: true,
    stops: seq.map((s) => s.station_name),
    stopTimes: seq,
    duration,
    routeNumber,
  };
}

function tripReachesDestination(origin, dest, row, depTime, options = {}) {
  const { fastMode = true } = options;
  const destLabel = dest.name.replace(/\s+Station$/i, "");
  const perStop = 4;
  const isLightRailRoute = /^L\d+/i.test(row.routeNumber);
  const isMetroRoute = /^M\d+/i.test(row.routeNumber);
  const isBusRoute =
    origin?.mode === "bus" ||
    dest?.mode === "bus" ||
    /^\d{1,4}[A-Z]?$/i.test(String(row.routeNumber || ""));

  if (isMetroRoute) {
    const pathIds = metroPathIdsOnRoute(origin.id, dest.id, row.routeNumber);
    if (pathIds.length < 2) return { ok: false };
    if (!fastMode) {
      const timed = pickTimedStopSequence(origin, dest, row, depTime);
      if (timed && timed.length >= 2) {
        const dep = parseTfnswTime(timed[0].time);
        const arr = parseTfnswTime(timed[timed.length - 1].time);
        const duration = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
        return {
          ok: true,
          stops: timed.map((s) => s.station_name),
          stopTimes: timed,
          duration,
          routeNumber: row.routeNumber,
        };
      }
    }
    return syntheticStopSequence(pathIds, depTime, 3, row.routeNumber);
  }

  if (isBusRoute && !isLightRailRoute) {
    const pathIds = busPathIdsOnBranch(origin.id, dest.id, row.routeNumber);
    if (pathIds.length < 2) return { ok: false };
    if (!fastMode) {
      const timed = pickTimedStopSequence(origin, dest, row, depTime);
      if (timed && timed.length >= 2) {
        const dep = parseTfnswTime(timed[0].time);
        const arr = parseTfnswTime(timed[timed.length - 1].time);
        const duration = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
        return {
          ok: true,
          stops: timed.map((s) => s.station_name),
          stopTimes: timed,
          duration,
          routeNumber: row.routeNumber,
        };
      }
    }
    return syntheticStopSequence(pathIds, depTime, 2, row.routeNumber);
  }

  if (isLightRailRoute) {
    const pathIds = lightRailPathIdsOnRoute(origin.id, dest.id, row.routeNumber);
    if (pathIds.length < 2) return { ok: false };

    if (!fastMode) {
      const timed = pickTimedStopSequence(origin, dest, row, depTime);
      if (timed && timed.length >= 2) {
        const dep = new Date(timed[0].time);
        const arr = new Date(timed[timed.length - 1].time);
        const duration = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
        return {
          ok: true,
          stops: timed.map((s) => s.station_name),
          stopTimes: timed,
          duration,
          routeNumber: row.routeNumber,
        };
      }
      return { ok: false };
    }

    return syntheticStopSequence(pathIds, depTime, perStop, row.routeNumber);
  }

  if (!fastMode) {
    const timedTrain = pickTimedStopSequence(origin, dest, row, depTime);
    if (timedTrain && timedTrain.length >= 2) {
      const dep = parseTfnswTime(timedTrain[0].time);
      const arr = parseTfnswTime(timedTrain[timedTrain.length - 1].time);
      const duration = Math.max(1, Math.round((arr.getTime() - dep.getTime()) / 60000));
      return {
        ok: true,
        stops: timedTrain.map((s) => s.station_name),
        stopTimes: timedTrain,
        duration,
        routeNumber: row.routeNumber,
      };
    }
  }

  if (!stationsConnectedOnRoute(origin.id, dest.id, row.routeNumber)) {
    return { ok: false };
  }

  const branchPath = findBranchPath(origin.id, dest.id, row.routeNumber);
  if (!branchPath) return { ok: false };

  const displayRoute = routeLabelsMatch(row.routeNumber, branchPath.route)
    ? row.routeNumber
    : branchPath.route;

  const seq = branchPath.stationIds.map((id, i) => ({
    station_name: STATION_NAME_BY_ID[id] || id,
    time: toIsoString(new Date(depTime.getTime() + i * perStop * 60_000)),
  }));

  const lastName = seq[seq.length - 1]?.station_name;
  if (!destinationMatches(lastName, destLabel) && !destinationMatches(lastName, dest.name)) {
    return { ok: false };
  }

  const duration = durationFromStopTimes(seq, (seq.length - 1) * perStop);
  return {
    ok: true,
    stops: seq.map((s) => s.station_name),
    stopTimes: seq,
    duration,
    routeNumber: displayRoute,
  };
}

/**
 * Build trip options from imported PDF weekday timetables (scheduled, not live TfNSW).
 */
function planDirectTripsFromTimetable(
  origin,
  dest,
  departDate,
  maxResults,
  includePast,
  fastMode = true,
  fullDay = false
) {
  const servingRoutes = directServingRoutes(origin, dest);
  const rows = filterRowsForRoutes(
    fullDay
      ? getScheduleRowsForTripPlan(origin.id, departDate, {
          includePast: true,
          pastLimit: 8,
          upcomingLimit: 900,
        })
      : includePast
        ? getDayScheduleRows(origin.id, departDate, 500)
        : getUpcomingScheduledRows(origin.id, departDate, Math.min(64, maxResults * 6)),
    servingRoutes
  );
  if (!rows.length) return [];

  const originMode = origin?.mode === "lightrail" ? "light_rail" : origin?.mode;
  const fastTrainReach =
    fastMode && originMode === "train"
      ? buildFastTrainReachResolver(origin, dest)
      : null;

  const reachCache = new Map();
  const cachedReach = (row, depTime) => {
    const key = `${routeForRow(row)}|${depTime.getTime()}`;
    if (reachCache.has(key)) return reachCache.get(key);
    const reach = tripReachesDestination(origin, dest, row, depTime, { fastMode });
    reachCache.set(key, reach);
    return reach;
  };

  const candidates = [];
  for (const entry of rows) {
    if (!fullDay && !includePast && candidates.length >= maxResults * 2) break;
    const { row, when: depTime, index } = entry;
    const reach = fastTrainReach ? fastTrainReach(row, depTime) : cachedReach(row, depTime);
    if (!reach.ok) continue;

    const arrTime =
      reach.stopTimes && reach.stopTimes.length >= 2
        ? parseTfnswTime(reach.stopTimes[reach.stopTimes.length - 1].time)
        : new Date(depTime.getTime() + reach.duration * 60000);
    const stopNames =
      reach.stops && reach.stops.length >= 2 ? reach.stops : [origin.name, dest.name];
    candidates.push({
      row,
      depTime,
      arrTime,
      duration: reach.duration,
      stopNames,
      stopTimes: reach.stopTimes ?? null,
      routeNumber: reach.routeNumber || row.routeNumber,
      index,
    });
  }

  candidates.sort((a, b) => a.depTime.getTime() - b.depTime.getTime());

  const bounded = fullDay ? candidates : candidates.slice(0, maxResults);

  return bounded.map(({ row, depTime, arrTime, duration, stopNames, stopTimes, routeNumber }, i) =>
    normalizeItineraryTimes({
      id: `tt_trip_${origin.id}_${dest.id}_${depTime.getTime()}_${i}`,
      totalDurationMinutes: duration,
      departureTime: toIsoString(depTime),
      arrivalTime: toIsoString(arrTime),
      isLive: false,
      transfersCount: 0,
      legs: [
        {
          mode: legModeForRoute(routeNumber || row.routeNumber, originMode),
          originName: origin.name,
          destinationName: dest.name,
          originId: origin.id,
          destinationId: dest.id,
          departureTime: toIsoString(depTime),
          arrivalTime: toIsoString(arrTime),
          durationMinutes: duration,
          platform: row.platform ? String(row.platform) : "—",
          routeNumber: routeNumber || row.routeNumber,
          stops: stopNames,
          stopTimes: stopTimes ?? undefined,
        },
      ],
    })
  );
}

export function planTripsFromTimetable(
  origin,
  dest,
  departDate = new Date(),
  maxResults = 8,
  options = {}
) {
  const { includePast = false, fastMode = true, fullDay = false } = options;
  if (!origin?.id || !dest?.id || origin.id === dest.id) return [];

  const originMode = origin?.mode === "lightrail" ? "light_rail" : origin?.mode;
  const destMode = dest?.mode === "lightrail" ? "light_rail" : dest?.mode;
  const cap = fullDay ? Math.min(maxResults, 500) : maxResults;
  const past = fullDay || includePast;

  if (originMode === "light_rail" && destMode === "light_rail") {
    const lr = planLightRailTripsFromTimetable(origin, dest, departDate, cap, {
      includePast: past,
      fastMode,
      fullDay,
    });
    if (lr.length > 0) return lr;
  }

  if (originMode === "metro" && destMode === "metro") {
    const metro = planDirectTripsFromTimetable(
      origin,
      dest,
      departDate,
      cap,
      past,
      fastMode,
      fullDay
    );
    if (metro.length > 0) return metro;
  }

  if (originMode === "bus" && destMode === "bus") {
    const bus = planDirectTripsFromTimetable(
      origin,
      dest,
      departDate,
      cap,
      past,
      fastMode,
      fullDay
    );
    if (bus.length > 0) return bus;
  }

  const direct = planDirectTripsFromTimetable(
    origin,
    dest,
    departDate,
    cap,
    past,
    fastMode,
    fullDay
  );
  if (direct.length > 0) return direct;

  // Many Sydney train trips require a CBD transfer (e.g. Auburn → Circular Quay).
  if (originMode === "train" && destMode === "train") {
    return buildTrainTransferTrips(origin, dest, departDate, cap, past, fastMode, fullDay);
  }

  return [];
}

function buildTrainTransferTrips(
  origin,
  dest,
  departDate,
  maxResults,
  includePast,
  fastMode = true,
  fullDay = false
) {
  const originRoutes = stationRoutes(origin.id).filter((r) => !/^L\d+$/i.test(r));
  const destRoutes = stationRoutes(dest.id).filter((r) => !/^L\d+$/i.test(r));
  if (!originRoutes.length || !destRoutes.length) return [];

  const out = [];
  const bestByDeparture = new Map();
  const changeBufferMin = 3;
  const secondRowsCache = new Map();
  const firstLegCache = new Map();

  const getSecondRows = (interchangeId, r2) => {
    const cacheKey = `${interchangeId}|${r2}|${includePast ? 1 : 0}|${fullDay ? 1 : 0}`;
    if (secondRowsCache.has(cacheKey)) return secondRowsCache.get(cacheKey);
    const secondRows =
      fullDay || includePast
        ? getRestOfDayScheduleRows(interchangeId, departDate, fullDay ? 600 : 80)
        : getUpcomingScheduledRows(interchangeId, departDate, 48);
    const filtered = secondRows
      .filter(({ row }) => routeLabelsMatch(routeForRow(row), r2))
      .sort((a, b) => a.when.getTime() - b.when.getTime());
    secondRowsCache.set(cacheKey, filtered);
    return filtered;
  };

  const getFirstLegTrips = (interchange) => {
    const cacheKey = `${origin.id}|${interchange.id}|${includePast ? 1 : 0}|${fullDay ? 1 : 0}`;
    if (firstLegCache.has(cacheKey)) return firstLegCache.get(cacheKey);
    const trips = planDirectTripsFromTimetable(
      origin,
      interchange,
      departDate,
      fullDay ? 60 : includePast ? 8 : 6,
      includePast || fullDay,
      fastMode,
      fullDay
    );
    firstLegCache.set(cacheKey, trips);
    return trips;
  };

  for (const r1 of originRoutes) {
    for (const r2 of destRoutes) {
      if (findBranchPath(origin.id, dest.id, r1) && routeLabelsMatch(r1, r2)) continue;

      const interchanges = findTrainInterchanges(r1, r2, origin.id, dest.id).slice(0, fullDay ? 2 : 3);
      for (const interchangeId of interchanges) {
        const interchangeName = STATION_NAME_BY_ID[interchangeId] || interchangeId;
        const interchange = { ...origin, id: interchangeId, name: interchangeName };

        const secondDayRows = getSecondRows(interchangeId, r2);
        const firstLegTrips = getFirstLegTrips(interchange);
        for (let idx = 0; idx < firstLegTrips.length; idx++) {
          const first = firstLegTrips[idx];
          const firstArr = parseTfnswTime(first.arrivalTime);
          const secondStart = new Date(firstArr.getTime() + changeBufferMin * 60000);
          const secondPick = secondDayRows.find(({ when }) => when.getTime() >= secondStart.getTime());
          if (!secondPick) continue;

          const secondReach = tripReachesDestination(
            interchange,
            dest,
            { ...secondPick.row, routeNumber: r2 },
            secondPick.when,
            { fastMode }
          );
          if (!secondReach.ok) continue;

          const secondArr = arrivalFromStopTimes(
            secondReach.stopTimes,
            new Date(secondPick.when.getTime() + secondReach.duration * 60000)
          );
          const firstLeg = {
            ...first.legs[0],
            arrivalTime: toIsoString(parseTfnswTime(first.arrivalTime)),
            durationMinutes: Math.max(
              1,
              Math.round(
                (parseTfnswTime(first.arrivalTime).getTime() -
                  parseTfnswTime(first.departureTime).getTime()) /
                  60000
              )
            ),
          };

          const candidate = normalizeItineraryTimes({
            id: `tt_train_xfer_${r1}_${r2}_${origin.id}_${dest.id}_${parseTfnswTime(first.departureTime).getTime()}_${interchangeId}_${idx}`,
            totalDurationMinutes: 0,
            departureTime: first.departureTime,
            arrivalTime: toIsoString(secondArr),
            isLive: false,
            transfersCount: 1,
            legs: [
              firstLeg,
              {
                mode: "train",
                originName: interchangeName,
                originId: interchangeId,
                destinationName: dest.name,
                destinationId: dest.id,
                departureTime: toIsoString(secondPick.when),
                arrivalTime: toIsoString(secondArr),
                durationMinutes: secondReach.duration,
                platform: secondPick.row.platform ? String(secondPick.row.platform) : "—",
                routeNumber: secondReach.routeNumber || r2,
                stops:
                  secondReach.stopTimes && secondReach.stopTimes.length >= 2
                    ? secondReach.stopTimes.map((s) => s.station_name)
                    : [interchangeName, dest.name],
                stopTimes: secondReach.stopTimes ?? undefined,
              },
            ],
          });

          // Multiple interchange options can produce near-identical trips for the same
          // departure minute. Keep the best (shortest) one to avoid huge payloads.
          const depKey = parseTfnswTime(candidate.departureTime).getTime();
          const existing = bestByDeparture.get(depKey);
          if (!existing || candidate.totalDurationMinutes < existing.totalDurationMinutes) {
            bestByDeparture.set(depKey, candidate);
          }
        }
      }
    }
  }

  out.push(...bestByDeparture.values());

  const sorted = out.sort(
    (a, b) => parseTfnswTime(a.departureTime).getTime() - parseTfnswTime(b.departureTime).getTime()
  );
  return sorted.slice(0, maxResults);
}

/*
 * NOTE: The block below used to be the direct-trip return for planTripsFromTimetable.
 * It is kept in git history; the new implementation returns above.
 */

function buildDirectTripsOnRoute(
  origin,
  dest,
  departDate,
  route,
  maxResults,
  includePast,
  fastMode = true,
  fullDay = false
) {
  const rows =
    fullDay || includePast
      ? getDayScheduleRows(origin.id, departDate, fullDay ? 5000 : 80)
      : getUpcomingScheduledRows(origin.id, departDate, 48);
  const candidates = rows
    .filter(({ row }) => routeForRow(row) === route)
    .map(({ row, when: depTime }) => {
      const reach = tripReachesDestination(
        origin,
        dest,
        { ...row, routeNumber: route },
        depTime,
        { fastMode }
      );
      if (!reach.ok) return null;
      const arrTime = arrivalFromStopTimes(
        reach.stopTimes,
        new Date(depTime.getTime() + reach.duration * 60000)
      );
      const stopTimes = reach.stopTimes && reach.stopTimes.length >= 2 ? reach.stopTimes : null;
      const stopNames = stopTimes ? stopTimes.map((s) => s.station_name) : [origin.name, dest.name];
      const duration = Math.max(
        1,
        Math.round((arrTime.getTime() - depTime.getTime()) / 60000)
      );
      return { row, depTime, arrTime, duration, stopNames, stopTimes };
    })
    .filter(Boolean)
    .sort((a, b) => a.depTime.getTime() - b.depTime.getTime())
    .slice(0, maxResults);

  return candidates.map(({ row, depTime, arrTime, duration, stopNames, stopTimes }, i) =>
    normalizeItineraryTimes({
      id: `tt_lr_direct_${route}_${origin.id}_${dest.id}_${depTime.getTime()}_${i}`,
      totalDurationMinutes: duration,
      departureTime: toIsoString(depTime),
      arrivalTime: toIsoString(arrTime),
      isLive: false,
      transfersCount: 0,
      legs: [
        {
          mode: "light_rail",
          originName: origin.name,
          destinationName: dest.name,
          originId: origin.id,
          destinationId: dest.id,
          departureTime: toIsoString(depTime),
          arrivalTime: toIsoString(arrTime),
          durationMinutes: duration,
          platform: row.platform ? String(row.platform) : "—",
          routeNumber: route,
          stops: stopNames,
          stopTimes: stopTimes ?? undefined,
        },
      ],
    })
  );
}

function buildTransferTrips(origin, dest, departDate, maxResults, includePast) {
  const originRoutes = stationRoutes(origin.id).filter((r) => /^L\d+$/i.test(r));
  const destRoutes = stationRoutes(dest.id).filter((r) => /^L\d+$/i.test(r));
  const out = [];
  const changeBufferMin = 2;

  for (const r1 of originRoutes) {
    for (const r2 of destRoutes) {
      if (r1 === r2) continue;
      const shared = (LIGHT_RAIL_LINE_STATION_IDS[r1] || []).filter((id) =>
        (LIGHT_RAIL_LINE_STATION_IDS[r2] || []).includes(id)
      );
      for (const interchangeId of shared) {
        const interchangeName = STATION_NAME_BY_ID[interchangeId] || interchangeId;
        const interchange = { ...origin, id: interchangeId, name: interchangeName };
        const firstLegTrips = buildDirectTripsOnRoute(
          origin,
          interchange,
          departDate,
          r1,
          6,
          includePast
        );
        for (const first of firstLegTrips) {
          const firstArr = parseTfnswTime(first.arrivalTime);
          const secondStart = new Date(firstArr.getTime() + changeBufferMin * 60000);
          const secondRows = getUpcomingScheduledRows(interchangeId, secondStart, 60)
            .filter(({ row }) => routeForRow(row) === r2)
            .map(({ row, when }) => ({ row, when }))
            .sort((a, b) => a.when.getTime() - b.when.getTime());
          const secondPick = secondRows.find(({ row, when }) => {
            const reach = tripReachesDestination(
              { ...origin, id: interchangeId, name: interchangeName },
              dest,
              { ...row, routeNumber: r2 },
              when
            );
            return reach.ok;
          });
          if (!secondPick) continue;
          const secondReach = tripReachesDestination(
            { ...origin, id: interchangeId, name: interchangeName },
            dest,
            { ...secondPick.row, routeNumber: r2 },
            secondPick.when
          );
          if (!secondReach.ok) continue;
          const secondArr = arrivalFromStopTimes(
            secondReach.stopTimes,
            new Date(secondPick.when.getTime() + secondReach.duration * 60000)
          );
          const leg2StopTimes =
            secondReach.stopTimes && secondReach.stopTimes.length >= 2 ? secondReach.stopTimes : null;

          out.push(
            normalizeItineraryTimes({
              id: `tt_lr_xfer_${r1}_${r2}_${origin.id}_${dest.id}_${parseTfnswTime(first.departureTime).getTime()}`,
              totalDurationMinutes: 0,
              departureTime: first.departureTime,
              arrivalTime: toIsoString(secondArr),
              isLive: false,
              transfersCount: 1,
              legs: [
                first.legs[0],
                {
                  mode: "light_rail",
                  originName: interchangeName,
                  destinationName: dest.name,
                  originId: interchangeId,
                  destinationId: dest.id,
                  departureTime: toIsoString(secondPick.when),
                  arrivalTime: toIsoString(secondArr),
                  durationMinutes: secondReach.duration,
                  platform: secondPick.row.platform ? String(secondPick.row.platform) : "—",
                  routeNumber: r2,
                  stops: leg2StopTimes
                    ? leg2StopTimes.map((s) => s.station_name)
                    : [interchangeName, dest.name],
                  stopTimes: leg2StopTimes ?? undefined,
                },
              ],
            })
          );
        }
      }
    }
  }

  return out
    .sort((a, b) => parseTfnswTime(a.departureTime).getTime() - parseTfnswTime(b.departureTime).getTime())
    .slice(0, maxResults);
}

export function planLightRailTripsFromTimetable(
  origin,
  dest,
  departDate = new Date(),
  maxResults = 8,
  options = {}
) {
  const { includePast = false, fastMode = true, fullDay = false } = options;
  const past = fullDay || includePast;
  if (!isLightRailStation(origin) || !isLightRailStation(dest)) return [];
  if (origin.id === dest.id) return [];

  const originRoutes = stationRoutes(origin.id).filter((r) => /^L\d+$/i.test(r));
  const destRoutes = stationRoutes(dest.id).filter((r) => /^L\d+$/i.test(r));
  const shared = originRoutes.filter((r) => destRoutes.includes(r));

  const direct = shared.flatMap((route) =>
    buildDirectTripsOnRoute(origin, dest, departDate, route, maxResults, past, fastMode, fullDay)
  );
  if (direct.length >= maxResults) {
    return direct
      .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
      .slice(0, maxResults);
  }

  const transfer = buildTransferTrips(origin, dest, departDate, maxResults, past);

  return [...direct, ...transfer]
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
    .slice(0, maxResults);
}
