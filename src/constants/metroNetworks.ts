import type { Station } from "./stations";
import metroNetwork from "./generated/metroNetwork.json";

export interface MetroLine {
  route: string;
  name: string;
  color: string;
  dests: string[];
  frequencyMins: number;
}

export const SYDNEY_METRO_STATIONS: Station[] = metroNetwork.stops.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  mode: "metro" as const,
  code: s.code,
}));

export const SYDNEY_METRO_LINES: MetroLine[] = metroNetwork.metroLines;

export const METRO_LINE_STATION_IDS: Record<string, string[]> = metroNetwork.lineStationIds;

export function getMetroLinesForStation(stationId: string): MetroLine[] {
  const routes = new Set<string>();
  for (const branch of metroNetwork.branches) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  return SYDNEY_METRO_LINES.filter((line) => routes.has(line.route));
}
