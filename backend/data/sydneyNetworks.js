/** Sydney Trains + Light Rail + Ferry metadata + station lists */
import { LINE_STATION_IDS as TRAIN_LINE_STATION_IDS, TRAIN_LINE_BRANCHES } from "./trainNetworkData.js";
import {
  FERRY_LINE_STATION_IDS,
  FERRY_LINE_BRANCHES,
  SYDNEY_FERRY_LINES,
  getFerryLinesForStation,
} from "./ferryNetworkData.js";
import {
  BUS_LINE_STATION_IDS,
  BUS_LINE_BRANCHES,
  SYDNEY_BUS_LINES,
  getBusLinesForStation,
} from "./busNetworkData.js";
import {
  LIGHT_RAIL_LINE_STATION_IDS,
  LIGHT_RAIL_LINE_BRANCHES,
  SYDNEY_LIGHT_RAIL_LINES,
  getLightRailLinesForStation,
} from "./lightRailNetworkData.js";
import {
  METRO_LINE_STATION_IDS,
  METRO_LINE_BRANCHES,
  SYDNEY_METRO_LINES,
  getMetroLinesForStation,
} from "./metroNetworkData.js";

export const SYDNEY_TRAIN_LINES = [
  { route: "T1", name: "T1 North Shore & Western Line", color: "#F6891F", dests: ["Penrith", "Richmond", "Emu Plains", "Berowra", "Hornsby", "Central"], frequencyMins: 8 },
  { route: "T2", name: "T2 Inner West & Leppington Line", color: "#80CC28", dests: ["Parramatta", "Leppington", "Macarthur", "Central"], frequencyMins: 10 },
  { route: "T3", name: "T3 Liverpool & Inner West Line", color: "#F37021", dests: ["Liverpool", "Lidcombe", "Bankstown", "Central"], frequencyMins: 12 },
  { route: "T4", name: "T4 Eastern Suburbs & Illawarra Line", color: "#0072CE", dests: ["Cronulla", "Waterfall", "Bondi Junction", "Central"], frequencyMins: 8 },
  { route: "T5", name: "T5 Cumberland Line", color: "#C41230", dests: ["Richmond", "Leppington", "Parramatta"], frequencyMins: 15 },
  { route: "T7", name: "T7 Olympic Park Line", color: "#6F2C91", dests: ["Olympic Park", "Lidcombe", "Central"], frequencyMins: 15 },
  { route: "T8", name: "T8 Airport & South Line", color: "#009374", dests: ["Macarthur", "Revesby", "Domestic Airport", "Central"], frequencyMins: 8 },
  { route: "T9", name: "T9 Northern Line", color: "#D11919", dests: ["Hornsby", "Gordon", "Central", "Strathfield"], frequencyMins: 10 },
  { route: "CCN", name: "Central Coast & Newcastle Line", color: "#F6891F", dests: ["Newcastle Interchange", "Gosford", "Central"], frequencyMins: 30 },
  { route: "BMT", name: "Blue Mountains Line", color: "#F6891F", dests: ["Lithgow", "Katoomba", "Central"], frequencyMins: 30 },
  { route: "SCO", name: "South Coast Line", color: "#0072CE", dests: ["Kiama", "Port Kembla", "Central"], frequencyMins: 30 },
];

export {
  SYDNEY_LIGHT_RAIL_LINES,
  LIGHT_RAIL_LINE_STATION_IDS,
  LIGHT_RAIL_LINE_BRANCHES,
  SYDNEY_METRO_LINES,
  METRO_LINE_STATION_IDS,
  METRO_LINE_BRANCHES,
};

export const LINE_STATION_IDS = {
  ...TRAIN_LINE_STATION_IDS,
  ...METRO_LINE_STATION_IDS,
  ...LIGHT_RAIL_LINE_STATION_IDS,
  ...FERRY_LINE_STATION_IDS,
  ...BUS_LINE_STATION_IDS,
};

export {
  FERRY_LINE_BRANCHES,
  FERRY_LINE_STATION_IDS,
  SYDNEY_FERRY_LINES,
  BUS_LINE_BRANCHES,
  BUS_LINE_STATION_IDS,
  SYDNEY_BUS_LINES,
};

export const SYDNEY_TRANSIT_LINES = [
  ...SYDNEY_TRAIN_LINES,
  ...SYDNEY_METRO_LINES,
  ...SYDNEY_LIGHT_RAIL_LINES,
  ...SYDNEY_FERRY_LINES,
  ...SYDNEY_BUS_LINES,
];

export function getLinesForStation(stationId) {
  const routes = new Set();
  for (const branch of TRAIN_LINE_BRANCHES) {
    if (branch.stationIds.includes(stationId)) routes.add(branch.route);
  }
  for (const line of getMetroLinesForStation(stationId)) {
    routes.add(line.route);
  }
  for (const line of getLightRailLinesForStation(stationId)) {
    routes.add(line.route);
  }
  for (const line of getFerryLinesForStation(stationId)) {
    routes.add(line.route);
  }
  for (const line of getBusLinesForStation(stationId)) {
    routes.add(line.route);
  }
  return SYDNEY_TRANSIT_LINES.filter((line) => routes.has(line.route));
}
