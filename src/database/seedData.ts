import { SYDNEY_STATIONS } from "../constants/stations";
const BUS_LINES_FALLBACK = [
  { route: "333", name: "333 Bondi Express", color: "#00B5E2", dests: ["Bondi Beach", "Circular Quay"], frequencyMins: 10 },
  { route: "B1", name: "B-Line", color: "#00B5E2", dests: ["Mona Vale", "Circular Quay"], frequencyMins: 10 },
];
import { SYDNEY_FERRY_LINES, getFerryLinesForStation } from "../constants/ferryNetworks";
import { getLinesForStation, SYDNEY_TRAIN_LINES } from "../constants/trainNetworks";
import type { Departure } from "../services/tfnsw";
import { buildLineStopSequence } from "../utils/trainStopSequence";
import { toIsoString } from "../utils/tfnswTime";

export { SYDNEY_STATIONS, SYDNEY_TRAIN_LINES };

/** Alerts come from live API only — no demo rows on device. */
export const DEFAULT_ALERTS: Array<{
  id: string;
  title: string;
  description: string;
  mode: string;
  severity: string;
  affected_routes: string;
}> = [];

const METRO_LINE = { route: "M1", name: "M1 Metro", color: "#0095A0", dests: ["Tallawong", "Sydenham", "Chatswood"], frequencyMins: 5 };
const LR_LINES = [
  { route: "L1", name: "L1 Dulwich Hill", color: "#E62B1E", dests: ["Dulwich Hill", "Central"], frequencyMins: 8 },
  { route: "L2", name: "L2 Randwick", color: "#E62B1E", dests: ["Randwick", "Circular Quay"], frequencyMins: 8 },
];
function generateStops(
  stationId: string,
  stationName: string,
  destinationName: string,
  mode: string,
  lineRoute: string,
  schedTime: Date,
  _realTime: Date
) {
  const anchor = schedTime;
  if (mode === "train") {
    const seq = buildLineStopSequence(stationId, destinationName, lineRoute, anchor);
    if (seq.length >= 2) return seq;
  }
  const destLabel =
    destinationName.includes("Station") || destinationName.includes("Wharf")
      ? destinationName
      : `${destinationName} Station`;
  const mins =
    mode === "ferry" ? 5 : mode === "light_rail" || mode === "lightrail" ? 4 : 3;
  return [
    { station_name: stationName, time: toIsoString(anchor), sort_order: 0 },
    {
      station_name: destLabel,
      time: toIsoString(new Date(anchor.getTime() + mins * 60000)),
      sort_order: 1,
    },
  ];
}

/** Generate departures with real-time offsets from now */
export function generateDeparturesForStation(stationId: string, count = 10) {
  const station = SYDNEY_STATIONS.find((s) => s.id === stationId);
  const now = new Date();

  let lines: typeof BUS_LINES_FALLBACK = [];
  let mode: Departure["mode"] = "train";

  if (station?.mode === "train") {
    lines = getLinesForStation(stationId);
    if (lines.length === 0) lines = SYDNEY_TRAIN_LINES.slice(0, 6);
    mode = "train";
  } else if (station?.mode === "metro") {
    lines = [METRO_LINE];
    mode = "metro";
  } else if (station?.mode === "ferry") {
    lines = getFerryLinesForStation(stationId);
    if (lines.length === 0) lines = SYDNEY_FERRY_LINES.slice(0, 4);
    mode = "ferry";
  } else if (station?.mode === "lightrail") {
    lines = LR_LINES;
    mode = "light_rail";
  } else if (station?.mode === "bus") {
    lines = BUS_LINES_FALLBACK;
    mode = "bus";
  } else {
    lines = SYDNEY_TRAIN_LINES.slice(0, 6);
    mode = "train";
  }

  if (lines.length === 0) return [];

  const departures = [];

  for (let i = 0; i < count; i++) {
    const line = lines[i % lines.length];
    const freq = line.frequencyMins || 10;
    const schedMins = 2 + i * freq;
    const schedTime = new Date(now.getTime() + schedMins * 60000);
    const delay = i % 5 === 1 ? Math.min(5, 2 + (i % 3)) : 0;
    const realTime = new Date(schedTime.getTime() + delay * 60000);
    const dest = line.dests[i % line.dests.length];

    departures.push({
      id: `dep_${stationId}_${line.route}_${schedTime.getTime()}_${i}`,
      station_id: stationId,
      route_number: line.route,
      destination: dest,
      mode,
      platform: mode === "ferry" ? `Wharf ${(i % 3) + 2}` : String((i % 6) + 1),
      scheduled_time: toIsoString(schedTime),
      delay_minutes: delay,
      line_color: line.color,
      line_name: line.name,
      stops: generateStops(
        stationId,
        station?.name || "Origin",
        dest,
        mode,
        line.route,
        schedTime,
        realTime
      ),
    });
  }
  return departures;
}
