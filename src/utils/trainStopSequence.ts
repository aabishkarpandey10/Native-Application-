import trainNetwork from "../constants/generated/trainNetwork.json";
import type { Station } from "../constants/stations";
import { findBranchPath, routeLabelsMatch } from "./trainNetworkPath";
import { toIsoString } from "./tfnswTime";

type Branch = { route: string; id: string; stationIds: string[] };

const STATION_BY_ID = Object.fromEntries(
  trainNetwork.stations.map((s) => [s.id, s as Station])
);

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+station$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function findStationIdByLabel(label: string, hintIds: string[] = []): string | null {
  const norm = normalizeName(label);
  const candidates = (hintIds.length ? hintIds.map((id) => STATION_BY_ID[id]) : trainNetwork.stations).filter(
    Boolean
  ) as Station[];

  let match = candidates.find((s) => normalizeName(s.name) === norm);
  if (match) return match.id;
  match = candidates.find(
    (s) => normalizeName(s.name).includes(norm) || norm.includes(normalizeName(s.name))
  );
  return match?.id ?? null;
}

function sliceBranch(branchIds: string[], fromIdx: number, toIdx: number) {
  if (fromIdx === toIdx) return [branchIds[fromIdx]];
  if (fromIdx < toIdx) return branchIds.slice(fromIdx, toIdx + 1);
  return branchIds.slice(toIdx, fromIdx + 1).reverse();
}

function distributeStopTimes(
  stops: { station_name: string; sort_order: number }[],
  departureTime: Date,
  minutesPerStop = 3
) {
  if (stops.length === 0) return [];
  if (stops.length === 1) {
    return [{ ...stops[0], time: toIsoString(departureTime) }];
  }
  return stops.map((stop, i) => ({
    ...stop,
    time: toIsoString(new Date(departureTime.getTime() + i * minutesPerStop * 60000)),
  }));
}

export function buildLineStopSequence(
  originStationId: string,
  destinationLabel: string,
  lineRoute?: string,
  departureTime: Date = new Date(),
  minutesPerStop = 3
): { station_name: string; time: string; sort_order: number }[] {
  const origin = STATION_BY_ID[originStationId];
  if (!origin) return [];

  const destId = findStationIdByLabel(destinationLabel);
  if (!destId) return [];

  const trainPath = findBranchPath(originStationId, destId, lineRoute || null);
  if (trainPath && trainPath.stationIds.length >= 2) {
    const names = trainPath.stationIds.map((id, i) => ({
      station_name: STATION_BY_ID[id]?.name || id,
      sort_order: i,
    }));
    return distributeStopTimes(names, departureTime, minutesPerStop);
  }

  const branches = (trainNetwork.branches as Branch[]).filter((b) =>
    lineRoute ? routeLabelsMatch(lineRoute, b.route) : true
  );

  let bestIds: string[] | null = null;
  for (const branch of branches) {
    const fromIdx = branch.stationIds.indexOf(originStationId);
    const toIdx = branch.stationIds.indexOf(destId);
    if (fromIdx === -1 || toIdx === -1) continue;

    const ids = sliceBranch(branch.stationIds, fromIdx, toIdx);
    if (ids.length < 2) continue;
    if (!bestIds || ids.length < bestIds.length) bestIds = ids;
  }
  if (bestIds) {
    const names = bestIds.map((id, i) => ({
      station_name: STATION_BY_ID[id]?.name || id,
      sort_order: i,
    }));
    return distributeStopTimes(names, departureTime, minutesPerStop);
  }

  const dest = STATION_BY_ID[destId];
  return distributeStopTimes(
    [
      { station_name: origin.name, sort_order: 0 },
      { station_name: dest?.name || destinationLabel, sort_order: 1 },
    ],
    departureTime,
    minutesPerStop
  );
}
