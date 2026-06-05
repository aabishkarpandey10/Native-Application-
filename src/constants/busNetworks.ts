import type { NetworkBranch } from "./transitNetworks";

export interface BusLine {
  route: string;
  name: string;
  color: string;
  dests: string[];
  frequencyMins: number;
}

let busMetaCache: {
  busLines: BusLine[];
  lineStationIds: Record<string, string[]>;
  branches: NetworkBranch[];
} | null = null;

async function loadBusMeta() {
  if (busMetaCache) return busMetaCache;
  const mod = await import("./generated/busRoutes.json");
  busMetaCache = {
    busLines: mod.busLines as BusLine[],
    lineStationIds: mod.lineStationIds as Record<string, string[]>,
    branches: (mod.branches as NetworkBranch[]).map((b) => ({
      id: b.id,
      route: b.route,
      name: b.name,
      color: b.color,
      stationIds: b.stationIds,
    })),
  };
  return busMetaCache;
}

export async function getBusLineBranches(): Promise<NetworkBranch[]> {
  return (await loadBusMeta()).branches;
}

export async function getSydneyBusLines(): Promise<BusLine[]> {
  return (await loadBusMeta()).busLines;
}

export function getBusLinesForStation(_stationId: string): BusLine[] {
  return [];
}
