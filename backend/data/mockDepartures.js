import { buildMockStopsForDeparture } from "./stopSequence.js";
import { getLinesForStation, SYDNEY_FERRY_LINES } from "./sydneyNetworks.js";
import { getLightRailLinesForStation } from "./lightRailNetworkData.js";
import { getMetroLinesForStation, SYDNEY_METRO_LINES } from "./metroNetworkData.js";
import { toIsoString } from "./tfnswTime.js";

const TRAIN_LINES_FALLBACK = [
  { route: "T1", name: "T1 North Shore & Western", color: "#F6891F", dests: ["Penrith", "Richmond", "Hornsby"], frequencyMins: 8 },
  { route: "T2", name: "T2 Inner West & Leppington", color: "#80CC28", dests: ["Parramatta", "Leppington", "Central"], frequencyMins: 10 },
  { route: "T3", name: "T3 Liverpool & Inner West", color: "#F37021", dests: ["Liverpool", "Bankstown", "Central"], frequencyMins: 12 },
  { route: "T4", name: "T4 Eastern Suburbs & Illawarra", color: "#0072CE", dests: ["Bondi Junction", "Cronulla", "Hurstville"], frequencyMins: 8 },
  { route: "T5", name: "T5 Cumberland", color: "#C41230", dests: ["Richmond", "Leppington", "Parramatta"], frequencyMins: 15 },
  { route: "T7", name: "T7 Olympic Park", color: "#6F2C91", dests: ["Olympic Park", "Lidcombe", "Central"], frequencyMins: 15 },
  { route: "T8", name: "T8 Airport & South", color: "#009374", dests: ["Macarthur", "Revesby", "Central"], frequencyMins: 8 },
  { route: "T9", name: "T9 Northern", color: "#D11919", dests: ["Hornsby", "Gordon", "Central"], frequencyMins: 10 },
];

const FERRY_LINES_FALLBACK = SYDNEY_FERRY_LINES.length
  ? SYDNEY_FERRY_LINES
  : [
      { route: "F1", name: "F1 Manly", color: "#52B848", dests: ["Manly", "Circular Quay"], frequencyMins: 20 },
      { route: "F3", name: "F3 Parramatta River", color: "#52B848", dests: ["Parramatta", "Circular Quay"], frequencyMins: 25 },
    ];

const METRO_LINES_FALLBACK = SYDNEY_METRO_LINES.length
  ? SYDNEY_METRO_LINES
  : [{ route: "M1", name: "M1 Metro North West & Bankstown Line", color: "#0095A0", dests: ["Tallawong", "Sydenham"], frequencyMins: 5 }];

/** Build mock departures for a station (same shape as /api/departures mock payload). */
export function buildMockDepartures(station, stationId, count = 8) {
  const now = new Date();
  let matchedLines = [];
  let mode = station?.mode === "lightrail" ? "light_rail" : station?.mode || "train";

  if (station) {
    if (station.mode === "train") {
      matchedLines = getLinesForStation(stationId);
      if (matchedLines.length === 0) matchedLines = TRAIN_LINES_FALLBACK;
    } else if (station.mode === "metro") {
      matchedLines = getMetroLinesForStation(stationId);
      if (matchedLines.length === 0) matchedLines = METRO_LINES_FALLBACK;
      mode = "metro";
    } else if (station.mode === "ferry") {
      matchedLines = getLinesForStation(stationId);
      if (matchedLines.length === 0) matchedLines = FERRY_LINES_FALLBACK;
      mode = "ferry";
    } else if (station.mode === "lightrail" || station.mode === "light_rail") {
      matchedLines = getLightRailLinesForStation(stationId);
      if (matchedLines.length === 0) {
        matchedLines = [
          { route: "L1", name: "L1 Dulwich Hill Line", color: "#BE1622", dests: ["Dulwich Hill", "Central"], frequencyMins: 8 },
          { route: "L2", name: "L2 Randwick Line", color: "#DD1E25", dests: ["Randwick", "Circular Quay"], frequencyMins: 8 },
          { route: "L3", name: "L3 Kingsford Line", color: "#781140", dests: ["Kingsford", "Circular Quay"], frequencyMins: 8 },
        ];
      }
      mode = "light_rail";
    } else if (station.mode === "bus") {
      matchedLines = [
        { route: "333", name: "333 Express", color: "#00B5E2", dests: ["Bondi Beach", "Circular Quay"], frequencyMins: 10 },
      ];
      mode = "bus";
    }
  } else {
    matchedLines = TRAIN_LINES_FALLBACK;
  }

  if (matchedLines.length === 0) return [];

  const departures = [];
  const depCount = Math.min(count, Math.max(matchedLines.length, 4));

  for (let i = 0; i < depCount; i++) {
    const line = matchedLines[i % matchedLines.length];
    const freq = line.frequencyMins || 10;
    const schedMins = 2 + i * freq;
    const schedTime = new Date(now.getTime() + schedMins * 60 * 1000);
    const delay = i % 5 === 1 ? Math.min(5, 2 + (i % 3)) : 0;
    const realTime = new Date(schedTime.getTime() + delay * 60 * 1000);
    const dest = line.dests[i % line.dests.length];

    departures.push({
      id: `mock_dep_${line.route}_${i}_${stationId}`,
      routeNumber: line.route,
      destination: dest,
      mode,
      scheduledTime: toIsoString(schedTime),
      realTime: toIsoString(realTime),
      delayMinutes: delay,
      platform: mode === "ferry" ? `Wharf ${(i % 3) + 2}` : `${(i % 4) + 1}`,
      status: delay > 0 ? "delayed" : "on_time",
      lineColor: line.color,
      lineName: line.name,
      stops: buildMockStopsForDeparture(
        station,
        stationId,
        dest,
        line.route,
        mode,
        schedTime,
        realTime
      ),
    });
  }

  return departures;
}
