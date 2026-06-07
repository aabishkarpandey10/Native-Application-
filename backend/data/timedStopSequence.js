/**
 * Stop sequences with times from Transport NSW PDF/GTFS timetables (per-station rows).
 */
import { BUS_LINE_BRANCHES, BUS_STATION_BY_ID } from "./busNetworkData.js";
import { buildStopSequenceFromTripTemplate } from "./busTripSequences.js";
import { LIGHT_RAIL_LINE_STATION_IDS } from "./sydneyNetworks.js";
import { SYDNEY_STATIONS } from "./sydneyStations.js";
import { TRAIN_LINE_BRANCHES } from "./trainNetworkData.js";
import { findBranchPath, routeLabelsMatch } from "./trainNetworkPath.js";
import { getDayScheduleRows } from "./customTimetables.js";
import { parseTfnswTime, toIsoString } from "./tfnswTime.js";

const ALL_STATIONS = [...SYDNEY_STATIONS, ...Object.values(BUS_STATION_BY_ID)];

const STATION_NAME_BY_ID = Object.fromEntries(ALL_STATIONS.map((s) => [s.id, s.name]));

const HEADSIGN_STATION_IDS = {
  central: "CENTRAL_T",
  city: "CENTRAL_T",
  townhall: "TOWNHALL_T",
  "town hall": "TOWNHALL_T",
  wynyard: "WYNYARD_T",
  circularquay: "CIRCULAR_QUAY_T",
  "circular quay": "CIRCULAR_QUAY_T",
};

function normalizeName(name) {
  return String(name || "")
    .replace(/\s+Station$/i, "")
    .replace(/,\s*Sydney$/i, "")
    .trim()
    .toLowerCase();
}

export function destinationMatches(depDest, stationName) {
  const a = normalizeName(depDest);
  const b = normalizeName(stationName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function routeForRow(row) {
  return String(row?.routeNumber || "").toUpperCase();
}

function lightRailPathIdsOnRoute(originId, destId, route) {
  const ids = LIGHT_RAIL_LINE_STATION_IDS[route] || [];
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

function stationPathIdsOnRoute(originId, destId, route) {
  if (/^L\d+$/i.test(route)) return lightRailPathIdsOnRoute(originId, destId, route);
  if (/^\d{1,4}[A-Z]?$/i.test(route) || /^B\d/i.test(route)) {
    return busPathIdsOnBranch(originId, destId, route);
  }
  return findBranchPath(originId, destId, route)?.stationIds || [];
}

function lightRailTerminalAtEnd(route, pathIds) {
  const ids = LIGHT_RAIL_LINE_STATION_IDS[route] || [];
  if (!ids.length) return null;
  const lastId = pathIds[pathIds.length - 1];
  const idx = ids.indexOf(lastId);
  if (idx === -1) return null;
  if (idx === 0) return STATION_NAME_BY_ID[ids[ids.length - 1]];
  if (idx === ids.length - 1) return STATION_NAME_BY_ID[ids[0]];
  return null;
}

function isBusRouteContext(originStationId, lineRoute) {
  return (
    /_B$/i.test(originStationId) ||
    /^\d{1,4}[A-Z0-9]*$/i.test(String(lineRoute || ""))
  );
}

/** Resolve terminus / headsign label to a station id (Transport NSW naming). */
export function resolveDestinationStationId(destinationLabel, originStationId, lineRoute) {
  const norm = normalizeName(destinationLabel);
  const compact = norm.replace(/\s+/g, "");
  const busContext = isBusRouteContext(originStationId, lineRoute);

  if (busContext) {
    let busMatch = Object.values(BUS_STATION_BY_ID).find((s) => normalizeName(s.name) === norm);
    if (!busMatch) {
      busMatch = Object.values(BUS_STATION_BY_ID).find(
        (s) =>
          normalizeName(s.name).includes(norm) || norm.includes(normalizeName(s.name))
      );
    }
    if (busMatch) return busMatch.id;

    let bestId = null;
    let bestDist = -1;
    for (const branch of BUS_LINE_BRANCHES) {
      if (lineRoute && String(branch.route) !== String(lineRoute)) continue;
      const fromIdx = branch.stationIds.indexOf(originStationId);
      if (fromIdx === -1) continue;
      for (let i = 0; i < branch.stationIds.length; i++) {
        const id = branch.stationIds[i];
        const name = STATION_NAME_BY_ID[id];
        if (!destinationMatches(destinationLabel, name)) continue;
        const dist = Math.abs(i - fromIdx);
        if (dist > bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
    }
    if (bestId) return bestId;
  }

  const alias = HEADSIGN_STATION_IDS[compact] || HEADSIGN_STATION_IDS[norm];
  if (alias && !busContext) return alias;

  let match = ALL_STATIONS.find((s) => normalizeName(s.name) === norm);
  if (match) return match.id;
  match = ALL_STATIONS.find(
    (s) =>
      normalizeName(s.name).includes(norm) ||
      norm.includes(normalizeName(s.name))
  );
  if (match) return match.id;

  let bestId = null;
  let bestDist = -1;
  for (const branch of TRAIN_LINE_BRANCHES) {
    if (lineRoute && !routeLabelsMatch(lineRoute, branch.route)) continue;
    const fromIdx = branch.stationIds.indexOf(originStationId);
    if (fromIdx === -1) continue;
    for (let i = 0; i < branch.stationIds.length; i++) {
      const id = branch.stationIds[i];
      const name = STATION_NAME_BY_ID[id];
      if (!destinationMatches(destinationLabel, name)) continue;
      const dist = Math.abs(i - fromIdx);
      if (dist > bestDist) {
        bestDist = dist;
        bestId = id;
      }
    }
  }
  if (!bestId && (lineRoute || /_B$/i.test(originStationId))) {
    for (const branch of BUS_LINE_BRANCHES) {
      if (lineRoute && String(branch.route) !== String(lineRoute)) continue;
      const fromIdx = branch.stationIds.indexOf(originStationId);
      if (fromIdx === -1) continue;
      for (let i = 0; i < branch.stationIds.length; i++) {
        const id = branch.stationIds[i];
        const name = STATION_NAME_BY_ID[id];
        if (!destinationMatches(destinationLabel, name)) continue;
        const dist = Math.abs(i - fromIdx);
        if (dist > bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
    }
  }
  return bestId;
}

/**
 * Build per-stop times from published timetable rows until service terminus (headsign).
 */
export function pickTimedStopSequence(origin, dest, row, depTime) {
  const route = routeForRow(row);
  const pathIds = stationPathIdsOnRoute(origin.id, dest.id, route);
  if (pathIds.length < 2) return null;

  const serviceHint = row.destination || dest.name;
  const destId = pathIds[pathIds.length - 1];
  const minTravelMs = (pathIds.length - 1) * 3 * 60_000;
  const outboundTerminal = lightRailTerminalAtEnd(route, pathIds);

  const expectedArrivalMs = depTime.getTime() + (pathIds.length - 1) * 4 * 60_000;
  const maxArrivalMs = depTime.getTime() + (pathIds.length - 1) * 8 * 60_000;

  let destArrival = null;
  if (outboundTerminal) {
    const outboundAtDest = getDayScheduleRows(destId, depTime, 120)
      .filter(
        ({ row: r, when }) =>
          routeForRow(r) === route &&
          destinationMatches(r.destination, outboundTerminal) &&
          when.getTime() >= depTime.getTime() + minTravelMs &&
          when.getTime() <= maxArrivalMs
      )
      .sort((a, b) => a.when.getTime() - b.when.getTime());
    if (outboundAtDest.length) {
      const best = outboundAtDest.reduce((pick, cur) => {
        const pickDelta = Math.abs(pick.when.getTime() - expectedArrivalMs);
        const curDelta = Math.abs(cur.when.getTime() - expectedArrivalMs);
        return curDelta < pickDelta ? cur : pick;
      });
      destArrival = new Date(best.when.getTime() - 75_000);
    }
  }

  const stopTimes = [];
  let cursor = depTime;
  const n = pathIds.length;

  for (let i = 0; i < n; i++) {
    const id = pathIds[i];
    const stName = STATION_NAME_BY_ID[id] || id;
    if (i === 0) {
      stopTimes.push({ station_name: stName, time: toIsoString(depTime) });
      continue;
    }

    if (i === n - 1 && destArrival && destArrival.getTime() > cursor.getTime()) {
      cursor = destArrival;
      stopTimes.push({ station_name: stName, time: toIsoString(destArrival) });
      continue;
    }

    const expected = destArrival
      ? new Date(
          depTime.getTime() + ((destArrival.getTime() - depTime.getTime()) * i) / (n - 1)
        )
      : new Date(depTime.getTime() + i * 4 * 60_000);

    const upper =
      destArrival?.getTime() ?? depTime.getTime() + (n - 1) * 6 * 60_000;
    const rows = getDayScheduleRows(id, depTime, 80).filter(
      ({ row: r, when }) =>
        routeForRow(r) === route &&
        destinationMatches(r.destination, serviceHint) &&
        when.getTime() >= cursor.getTime() + 20_000 &&
        when.getTime() <= upper
    );

    let picked = rows.length
      ? rows.reduce((best, cur) => {
          const bestDelta = Math.abs(best.when.getTime() - expected.getTime());
          const curDelta = Math.abs(cur.when.getTime() - expected.getTime());
          return curDelta < bestDelta ? cur : best;
        }).when
      : expected;

    if (picked.getTime() <= cursor.getTime()) {
      picked = new Date(Math.max(expected.getTime(), cursor.getTime() + 3 * 60_000));
    }
    cursor = picked;
    stopTimes.push({ station_name: stName, time: toIsoString(picked) });
  }

  if (stopTimes.length < 2) return null;
  const dep = parseTfnswTime(stopTimes[0].time);
  const arr = parseTfnswTime(stopTimes[stopTimes.length - 1].time);
  if (arr.getTime() <= dep.getTime()) return null;
  return stopTimes;
}

/** Timetable board: all stops from this station until trip terminus. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Match a TfNSW leg stop name (+ optional coords) to a synced bus stop id. */
export function resolveBusStationIdByName(name, lat, lon) {
  const norm = normalizeName(name);
  if (!norm) return null;

  let bestId = null;
  let bestScore = -1;

  for (const stop of Object.values(BUS_STATION_BY_ID)) {
    const sn = normalizeName(stop.name);
    let score = 0;
    if (sn === norm) score += 12;
    else if (sn.includes(norm) || norm.includes(sn)) score += 6;

    if (lat != null && lon != null && Number.isFinite(stop.lat) && Number.isFinite(stop.lon)) {
      const km = haversineKm(lat, lon, stop.lat, stop.lon);
      if (km < 0.08) score += 10;
      else if (km < 0.25) score += 5;
      else if (km < 0.6) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = stop.id;
    }
  }

  return bestScore >= 6 ? bestId : null;
}

function spreadStopsOnBranch(pathIds, depTime, arrTime) {
  if (pathIds.length < 2) return null;
  const depMs = depTime.getTime();
  const arrMs = Math.max(arrTime.getTime(), depMs + 60_000);
  const span = arrMs - depMs;
  return pathIds.map((id, i) => ({
    station_name: STATION_NAME_BY_ID[id] || id,
    time: toIsoString(new Date(depMs + (span * i) / (pathIds.length - 1))),
    stopId: id,
  }));
}

/**
 * Build stop-by-stop times for a live TfNSW bus leg (transportnsw.info style).
 * Uses trip-linked GTFS templates, then timetable rows, then branch geography.
 */
export function buildBusLegStopSequence({
  originName,
  destinationName,
  routeNumber,
  destinationLabel,
  depTime,
  arrTime,
  originLat,
  originLon,
  destLat,
  destLon,
  partialStopTimes,
}) {
  if (partialStopTimes?.length >= 3) return partialStopTimes;

  const dep = depTime instanceof Date ? depTime : parseTfnswTime(depTime);
  const arr = arrTime instanceof Date ? arrTime : parseTfnswTime(arrTime);
  const route = String(routeNumber || "").trim();
  const headsign = destinationLabel || destinationName || "";

  const originId = resolveBusStationIdByName(originName, originLat, originLon);
  const destId = resolveBusStationIdByName(destinationName, destLat, destLon);

  if (originId && route) {
    const fromTemplate = buildStopSequenceFromTripTemplate({
      routeNumber: route,
      destinationLabel: headsign,
      originStationId: originId,
      depTime: dep,
    });
    if (fromTemplate?.length >= 2) return fromTemplate;
  }

  if (originId && destId && route) {
    const pathIds = busPathIdsOnBranch(originId, destId, route);
    if (pathIds.length >= 2) {
      const row = { routeNumber: route, destination: headsign };
      const timed = pickTimedStopSequence(
        { id: originId, name: originName },
        { id: destId, name: destinationName },
        row,
        dep
      );
      if (timed?.length >= 2) return timed;
      const spread = spreadStopsOnBranch(pathIds, dep, arr);
      if (spread?.length >= 2) return spread;
    }
  }

  if (partialStopTimes?.length >= 2) return partialStopTimes;

  if (originName && destinationName) {
    return [
      { station_name: originName.replace(/, Sydney/gi, "").trim(), time: toIsoString(dep) },
      { station_name: destinationName.replace(/, Sydney/gi, "").trim(), time: toIsoString(arr) },
    ];
  }

  return null;
}

export function buildDepartureStopSequence(station, stationId, row, schedTime) {
  const anchor = schedTime instanceof Date ? schedTime : new Date(schedTime);
  const route = routeForRow(row);

  const fromTemplate = buildStopSequenceFromTripTemplate({
    routeNumber: route,
    destinationLabel: row.destination,
    originStationId: stationId,
    depTime: anchor,
  });
  if (fromTemplate?.length >= 2) return fromTemplate;

  const terminusId = resolveDestinationStationId(row.destination, stationId, route);
  if (!terminusId) return null;

  const pseudoDest = {
    id: terminusId,
    name: row.destination || STATION_NAME_BY_ID[terminusId] || "Terminus",
  };
  return pickTimedStopSequence(
    { id: stationId, name: station?.name || stationId },
    pseudoDest,
    row,
    anchor
  );
}

export function estimateServiceEndMs(stationId, row, depWhen) {
  const route = routeForRow(row);
  const terminusId = resolveDestinationStationId(row.destination, stationId, route);
  if (/^\d{1,4}[A-Z]?$/i.test(route) || /^B\d/i.test(route)) {
    if (terminusId) {
      const pathIds = busPathIdsOnBranch(stationId, terminusId, route);
      if (pathIds.length >= 2) {
        return depWhen.getTime() + (pathIds.length - 1) * 2 * 60_000;
      }
    }
    return depWhen.getTime() + 50 * 60_000;
  }
  const path = terminusId ? findBranchPath(stationId, terminusId, route) : null;
  const hops = path?.stationIds?.length ?? 12;
  const perStopMs = /^L\d/i.test(route) ? 4 * 60_000 : 3 * 60_000;
  return depWhen.getTime() + Math.max(hops - 1, 1) * perStopMs;
}
