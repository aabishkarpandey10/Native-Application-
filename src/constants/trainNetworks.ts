import type { Station } from "./stations";
import { SYDNEY_STATIONS } from "./stations";
import trainNetwork from "./generated/trainNetwork.json";

export interface TrainLine {
  route: string;
  name: string;
  color: string;
  dests: string[];
  frequencyMins: number;
}

export const SYDNEY_TRAIN_LINES: TrainLine[] = [
  { route: "T1", name: "T1 North Shore & Western", color: "#F6891F", dests: ["Penrith", "Richmond", "Emu Plains", "Berowra", "Hornsby", "Central"], frequencyMins: 8 },
  { route: "T2", name: "T2 Inner West & Leppington", color: "#80CC28", dests: ["Parramatta", "Leppington", "Macarthur", "Central"], frequencyMins: 10 },
  { route: "T3", name: "T3 Liverpool & Inner West", color: "#F37021", dests: ["Liverpool", "Lidcombe", "Bankstown", "Central"], frequencyMins: 12 },
  { route: "T4", name: "T4 Eastern Suburbs & Illawarra", color: "#0072CE", dests: ["Cronulla", "Waterfall", "Bondi Junction", "Central"], frequencyMins: 8 },
  { route: "T5", name: "T5 Cumberland", color: "#C41230", dests: ["Richmond", "Leppington", "Parramatta"], frequencyMins: 15 },
  { route: "T6", name: "T6 Carlingford (replacement bus)", color: "#717430", dests: ["Telopea", "Clyde"], frequencyMins: 20 },
  { route: "T7", name: "T7 Olympic Park", color: "#6F2C91", dests: ["Olympic Park", "Lidcombe", "Central"], frequencyMins: 15 },
  { route: "T8", name: "T8 Airport & South", color: "#009374", dests: ["Macarthur", "Revesby", "Domestic Airport", "Central"], frequencyMins: 8 },
  { route: "T9", name: "T9 Northern", color: "#D11919", dests: ["Hornsby", "Gordon", "Central", "Strathfield"], frequencyMins: 10 },
  { route: "CCN", name: "Central Coast & Newcastle", color: "#F6891F", dests: ["Newcastle Interchange", "Gosford", "Central"], frequencyMins: 30 },
  { route: "BMT", name: "Blue Mountains", color: "#F6891F", dests: ["Lithgow", "Katoomba", "Central"], frequencyMins: 30 },
  { route: "SCO", name: "South Coast", color: "#0072CE", dests: ["Kiama", "Port Kembla", "Central"], frequencyMins: 30 },
  { route: "HUN", name: "Hunter Line", color: "#833134", dests: ["Newcastle Interchange", "Maitland"], frequencyMins: 30 },
  { route: "SPL", name: "Southern Highlands", color: "#00954C", dests: ["Campbelltown", "Moss Vale", "Central"], frequencyMins: 45 },
];

/** Ordered station IDs per line (from generated network graph). */
export const LINE_STATION_IDS: Record<string, string[]> = trainNetwork.lineStationIds;

export function getLinesForStation(stationId: string): TrainLine[] {
  return SYDNEY_TRAIN_LINES.filter((line) =>
    LINE_STATION_IDS[line.route]?.includes(stationId)
  );
}

export function getStationsForLine(route: string): Station[] {
  const ids = LINE_STATION_IDS[route] ?? [];
  return SYDNEY_STATIONS.filter((s) => ids.includes(s.id));
}

export function getTrainLine(route: string): TrainLine | undefined {
  return SYDNEY_TRAIN_LINES.find((l) => l.route === route);
}
