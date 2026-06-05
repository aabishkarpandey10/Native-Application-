import { TRAIN_LINE_BRANCHES } from "./trainNetworkData.js";

/** T2 and T3 share Inner West / Bankstown services in timetables. */
export function routeLabelsMatch(a, b) {
  const A = String(a || "").toUpperCase();
  const B = String(b || "").toUpperCase();
  if (!A || !B) return false;
  if (A === B) return true;
  if ((A === "T2" || A === "T3") && (B === "T2" || B === "T3")) return true;
  return false;
}

function sliceBranch(branchIds, fromIdx, toIdx) {
  if (fromIdx === toIdx) return [branchIds[fromIdx]];
  if (fromIdx < toIdx) return branchIds.slice(fromIdx, toIdx + 1);
  return branchIds.slice(toIdx, fromIdx + 1).reverse();
}

/** Curated branches trump GTFS trip fragments (avoids bogus shortcut paths). */
function branchPriority(branch) {
  const id = String(branch?.id || "");
  if (id.startsWith("gtfs_")) return 2;
  if (/^T\d+_|^CCN_|^BMT_|^SCO_/.test(id)) return 0;
  return 1;
}

function isBetterBranchPath(candidate, current) {
  if (!current) return true;
  const priA = branchPriority(candidate.branch);
  const priB = branchPriority(current.branch);
  if (priA !== priB) return priA < priB;
  if (candidate.hopCount !== current.hopCount) return candidate.hopCount < current.hopCount;
  return String(candidate.branch.id || "").length < String(current.branch.id || "").length;
}

/**
 * Shortest branch-aligned path between two train stations (optional route filter).
 * Returns ordered station IDs on one physical branch, or null if not directly connected.
 */
export function findBranchPath(originId, destId, route = null) {
  if (!originId || !destId || originId === destId) return null;

  let best = null;
  for (const branch of TRAIN_LINE_BRANCHES) {
    if (route && !routeLabelsMatch(route, branch.route)) continue;

    const fromIdx = branch.stationIds.indexOf(originId);
    const toIdx = branch.stationIds.indexOf(destId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) continue;

    const hopCount = Math.abs(toIdx - fromIdx);
    const candidate = {
      route: branch.route,
      branchId: branch.id,
      branch,
      hopCount,
      stationIds: sliceBranch(branch.stationIds, fromIdx, toIdx),
    };
    if (isBetterBranchPath(candidate, best)) best = candidate;
  }
  if (!best) return null;
  const { branch: _b, ...path } = best;
  return path;
}

export function stationsConnectedOnRoute(originId, destId, route) {
  return !!findBranchPath(originId, destId, route);
}

const TRAIN_INTERCHANGE_HUBS = [
  "CENTRAL_T",
  "TOWNHALL_T",
  "WYNYARD_T",
  "STRATHFIELD_T",
  "REDFERN_T",
  "LIDCOMBE_T",
  "PARRAMATTA_T",
  "BLACKTOWN_T",
  "HORNSBY_T",
  "CHATSWOOD_T",
];

export function findTrainInterchanges(routeA, routeB, originId, destId, limit = 4) {
  const rank = (id) => {
    const idx = TRAIN_INTERCHANGE_HUBS.indexOf(id);
    return idx === -1 ? 999 : idx;
  };

  return TRAIN_INTERCHANGE_HUBS.filter(
    (hubId) =>
      findBranchPath(originId, hubId, routeA) && findBranchPath(hubId, destId, routeB)
  )
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit);
}
