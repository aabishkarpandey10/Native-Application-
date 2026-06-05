import trainNetwork from "../constants/generated/trainNetwork.json";

type Branch = { route: string; id: string; stationIds: string[] };

export function routeLabelsMatch(a: string, b: string): boolean {
  const A = String(a || "").toUpperCase();
  const B = String(b || "").toUpperCase();
  if (!A || !B) return false;
  if (A === B) return true;
  if ((A === "T2" || A === "T3") && (B === "T2" || B === "T3")) return true;
  return false;
}

function sliceBranch(branchIds: string[], fromIdx: number, toIdx: number): string[] {
  if (fromIdx === toIdx) return [branchIds[fromIdx]];
  if (fromIdx < toIdx) return branchIds.slice(fromIdx, toIdx + 1);
  return branchIds.slice(toIdx, fromIdx + 1).reverse();
}

function branchPriority(branch: Branch): number {
  const id = branch.id || "";
  if (id.startsWith("gtfs_")) return 2;
  if (/^T\d+_|^CCN_|^BMT_|^SCO_/.test(id)) return 0;
  return 1;
}

export function findBranchPath(
  originId: string,
  destId: string,
  route: string | null = null
): { route: string; branchId: string; hopCount: number; stationIds: string[] } | null {
  if (!originId || !destId || originId === destId) return null;

  let best: {
    route: string;
    branchId: string;
    hopCount: number;
    stationIds: string[];
    pri: number;
  } | null = null;

  for (const branch of trainNetwork.branches as Branch[]) {
    if (route && !routeLabelsMatch(route, branch.route)) continue;

    const fromIdx = branch.stationIds.indexOf(originId);
    const toIdx = branch.stationIds.indexOf(destId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) continue;

    const hopCount = Math.abs(toIdx - fromIdx);
    const pri = branchPriority(branch);
    const candidate = {
      route: branch.route,
      branchId: branch.id,
      hopCount,
      stationIds: sliceBranch(branch.stationIds, fromIdx, toIdx),
      pri,
    };
    if (
      !best ||
      pri < best.pri ||
      (pri === best.pri && hopCount < best.hopCount)
    ) {
      best = candidate;
    }
  }
  if (!best) return null;
  const { pri: _p, ...path } = best;
  return path;
}
