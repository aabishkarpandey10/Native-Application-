import type { Station } from "./stations";
import ferryNetwork from "./generated/ferryNetwork.json";

export interface FerryLine {
  route: string;
  name: string;
  color: string;
  dests: string[];
  frequencyMins: number;
}

export const SYDNEY_FERRY_WHARFS: Station[] = ferryNetwork.wharfs.map((w) => ({
  id: w.id,
  name: w.name,
  lat: w.lat,
  lon: w.lon,
  mode: "ferry" as const,
  code: w.code,
}));

export const SYDNEY_FERRY_LINES: FerryLine[] = ferryNetwork.ferryLines;

export const FERRY_LINE_STATION_IDS: Record<string, string[]> = ferryNetwork.lineStationIds;

export function getFerryLinesForStation(stationId: string): FerryLine[] {
  const routes = new Set<string>();
  for (const branch of ferryNetwork.branches) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_FERRY_LINES.filter((line) => routes.has(line.route));
}

export function getWharfsForRoute(route: string): Station[] {
  const ids = FERRY_LINE_STATION_IDS[route] ?? [];
  const byId = Object.fromEntries(SYDNEY_FERRY_WHARFS.map((w) => [w.id, w]));
  return ids.map((id) => byId[id]).filter(Boolean) as Station[];
}
