import type { Station } from "./stations";
import lightRailNetwork from "./generated/lightRailNetwork.json";

export interface LightRailLine {
  route: string;
  name: string;
  color: string;
  dests: string[];
  frequencyMins: number;
}

export const SYDNEY_LIGHT_RAIL_STOPS: Station[] = lightRailNetwork.stops.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  mode: "lightrail" as const,
  code: s.code,
}));

export const SYDNEY_LIGHT_RAIL_LINES: LightRailLine[] = lightRailNetwork.lightRailLines;

export const LIGHT_RAIL_LINE_STATION_IDS: Record<string, string[]> =
  lightRailNetwork.lineStationIds;

export function getLightRailLinesForStation(stationId: string): LightRailLine[] {
  const routes = new Set<string>();
  for (const branch of lightRailNetwork.branches) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_LIGHT_RAIL_LINES.filter((line) => routes.has(line.route));
}
