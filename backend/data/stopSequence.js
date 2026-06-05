import {
  STATION_BY_ID,
  TRAIN_LINE_BRANCHES,
  getLinesForStation,
} from "./trainNetworkData.js";
import { findBranchPath, routeLabelsMatch } from "./trainNetworkPath.js";
import { FERRY_LINE_BRANCHES } from "./ferryNetworkData.js";
import { BUS_LINE_BRANCHES } from "./busNetworkData.js";
import { LIGHT_RAIL_LINE_BRANCHES } from "./lightRailNetworkData.js";
import { METRO_LINE_BRANCHES } from "./metroNetworkData.js";
import { SYDNEY_STATIONS } from "./sydneyStations.js";
import { toIsoString } from "./tfnswTime.js";
import { buildDepartureStopSequence } from "./timedStopSequence.js";

const ALL_STATIONS_BY_ID = Object.fromEntries(
  SYDNEY_STATIONS.map((s) => [s.id, s])
);

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+station$/i, "")
    .replace(/\s+wharf.*$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function findStationIdByLabel(label, stationIdsHint = []) {
  if (!label) return null;
  const norm = normalizeName(label);
  const candidates = stationIdsHint.length
    ? stationIdsHint.map((id) => ALL_STATIONS_BY_ID[id]).filter(Boolean)
    : Object.values(ALL_STATIONS_BY_ID);

  let match = candidates.find((s) => normalizeName(s.name) === norm);
  if (match) return match.id;

  match = candidates.find((s) => normalizeName(s.name).includes(norm) || norm.includes(normalizeName(s.name)));
  if (match) return match.id;

  match = candidates.find((s) => normalizeName(s.code) === norm);
  return match?.id ?? null;
}

function sliceBranch(branchIds, fromIdx, toIdx) {
  if (fromIdx === toIdx) return [branchIds[fromIdx]];
  if (fromIdx < toIdx) return branchIds.slice(fromIdx, toIdx + 1);
  return branchIds.slice(toIdx, fromIdx + 1).reverse();
}

/**
 * Build geographically ordered stop sequence between origin and destination on a line branch.
 */
export function buildLineStopSequence({
  originStationId,
  destinationLabel,
  lineRoute,
  schedTime = new Date(),
  minutesPerStop = 4,
}) {
  const origin = ALL_STATIONS_BY_ID[originStationId];
  if (!origin || !destinationLabel) return [];

  const destId = findStationIdByLabel(destinationLabel);
  if (!destId) return [];

  const trainPath = findBranchPath(originStationId, destId, lineRoute || null);
  if (trainPath && trainPath.stationIds.length >= 2) {
    return trainPath.stationIds.map((id, i) => {
      const st = ALL_STATIONS_BY_ID[id];
      return {
        station_name: st?.name || id,
        time: toIsoString(new Date(schedTime.getTime() + i * minutesPerStop * 60000)),
      };
    });
  }

  const routes = lineRoute ? [lineRoute] : getLinesForStation(originStationId);
  const allBranches = [
    ...TRAIN_LINE_BRANCHES,
    ...METRO_LINE_BRANCHES,
    ...LIGHT_RAIL_LINE_BRANCHES,
    ...FERRY_LINE_BRANCHES,
    ...BUS_LINE_BRANCHES,
  ];
  const branches = allBranches.filter((b) =>
    routes.some((r) => routeLabelsMatch(r, b.route) || r === b.route)
  );

  let bestIds = null;
  for (const branch of branches) {
    const fromIdx = branch.stationIds.indexOf(originStationId);
    const toIdx = branch.stationIds.indexOf(destId);
    if (fromIdx === -1 || toIdx === -1) continue;

    const ids = sliceBranch(branch.stationIds, fromIdx, toIdx);
    if (ids.length < 2) continue;
    if (!bestIds || ids.length < bestIds.length) bestIds = ids;
  }
  if (bestIds) {
    return bestIds.map((id, i) => {
      const st = ALL_STATIONS_BY_ID[id];
      return {
        station_name: st?.name || id,
        time: toIsoString(new Date(schedTime.getTime() + i * minutesPerStop * 60000)),
      };
    });
  }

  // Route can have separate branches (e.g. T4 Illawarra + T4 Eastern).
  // If origin/destination are on different branches of the same route,
  // stitch via a shared interchange station on that route.
  let stitchedBest = null;
  for (const fromBranch of branches) {
    const fromIdx = fromBranch.stationIds.indexOf(originStationId);
    if (fromIdx === -1) continue;
    for (const toBranch of branches) {
      const toIdx = toBranch.stationIds.indexOf(destId);
      if (toIdx === -1) continue;

      const shared = fromBranch.stationIds.filter((id) => toBranch.stationIds.includes(id));
      for (const interchangeId of shared) {
        const viaFromIdx = fromBranch.stationIds.indexOf(interchangeId);
        const viaToIdx = toBranch.stationIds.indexOf(interchangeId);
        if (viaFromIdx === -1 || viaToIdx === -1) continue;

        const first = sliceBranch(fromBranch.stationIds, fromIdx, viaFromIdx);
        const second = sliceBranch(toBranch.stationIds, viaToIdx, toIdx);
        if (first.length < 2 || second.length < 2) continue;

        const merged = [...first, ...second.slice(1)];
        if (!stitchedBest || merged.length < stitchedBest.length) {
          stitchedBest = merged;
        }
      }
    }
  }
  if (stitchedBest && stitchedBest.length >= 2) {
    return stitchedBest.map((id, i) => {
      const st = ALL_STATIONS_BY_ID[id];
      return {
        station_name: st?.name || id,
        time: toIsoString(new Date(schedTime.getTime() + i * minutesPerStop * 60000)),
      };
    });
  }

  // Same branch not found — try any branch containing both
  for (const branch of allBranches) {
    const fromIdx = branch.stationIds.indexOf(originStationId);
    const toIdx = branch.stationIds.indexOf(destId);
    if (fromIdx === -1 || toIdx === -1) continue;

    const ids = sliceBranch(branch.stationIds, fromIdx, toIdx);
    return ids.map((id, i) => {
      const st = ALL_STATIONS_BY_ID[id];
      return {
        station_name: st?.name || id,
        time: toIsoString(new Date(schedTime.getTime() + i * minutesPerStop * 60000)),
      };
    });
  }

  const destStation = ALL_STATIONS_BY_ID[destId];
  return [
    { station_name: origin.name, time: toIsoString(schedTime) },
    {
      station_name: destStation?.name || destinationLabel,
      time: toIsoString(new Date(schedTime.getTime() + minutesPerStop * 60000)),
    },
  ];
}

/**
 * Fallback for non-train modes (metro, ferry, light rail).
 */
export function buildSimpleStopSequence(stationName, destinationName, schedTime, minutesPerStop = 4) {
  const names = [stationName, destinationName].filter(Boolean);
  return names.map((station_name, i) => ({
    station_name,
    time: toIsoString(new Date(schedTime.getTime() + i * minutesPerStop * 60000)),
  }));
}

/** Spread stop times forward from the real departure (or scheduled) at the origin. */
export function distributeStopTimes(stops, departureTime, minutesPerStop = 3) {
  if (!stops?.length) return [];
  const depart = departureTime instanceof Date ? departureTime : new Date(departureTime);
  if (stops.length === 1) {
    return [{ ...stops[0], time: toIsoString(depart) }];
  }
  return stops.map((stop, i) => ({
    ...stop,
    time: toIsoString(new Date(depart.getTime() + i * minutesPerStop * 60000)),
  }));
}

export function buildMockStopsForDeparture(
  station,
  stationId,
  destinationLabel,
  lineRoute,
  mode,
  schedTime,
  _realTime,
  timetableRow = null
) {
  const anchor = schedTime instanceof Date ? schedTime : new Date(schedTime);
  const perStop =
    mode === "train" || mode === "rail" ? 3 : mode === "ferry" ? 5 : 4;

  const row =
    timetableRow ||
    (destinationLabel
      ? { destination: destinationLabel, routeNumber: lineRoute || "T1" }
      : null);
  if (row) {
    const timed = buildDepartureStopSequence(station, stationId, row, anchor);
    if (timed?.length >= 2) return timed;
  }

  if (mode === "metro" || /^M\d/i.test(lineRoute || "")) {
    const stops = buildLineStopSequence({
      originStationId: stationId,
      destinationLabel,
      lineRoute: lineRoute || "M1",
      schedTime: anchor,
      minutesPerStop: 0,
    });
    if (stops.length >= 2) {
      return distributeStopTimes(stops, anchor, 3);
    }
  }

  if (mode === "train" || mode === "rail") {
    const stops = buildLineStopSequence({
      originStationId: stationId,
      destinationLabel,
      lineRoute,
      schedTime: anchor,
      minutesPerStop: 0,
    });
    if (stops.length >= 2) {
      return distributeStopTimes(stops, anchor, perStop);
    }
  }
  const simple = buildSimpleStopSequence(
    station?.name || "Origin",
    destinationLabel.includes("Station") ? destinationLabel : `${destinationLabel} Station`,
    anchor,
    0
  );
  return distributeStopTimes(simple, anchor, perStop);
}
