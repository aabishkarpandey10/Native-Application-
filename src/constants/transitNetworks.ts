import trainNetwork from "./generated/trainNetwork.json";
import { SYDNEY_STATIONS, type Station } from "./stations";
import { NETWORK_EXTRA_STATIONS } from "./networkStations";
import { SYDNEY_TRAIN_LINES } from "./trainNetworks";
import transitNetworks from "./generated/transitNetworks.json";
import ferryNetwork from "./generated/ferryNetwork.json";
import lightRailNetwork from "./generated/lightRailNetwork.json";
import metroNetwork from "./generated/metroNetwork.json";

export type TransitModeKey = "metro" | "train" | "lightrail" | "bus" | "ferry";

export interface NetworkBranch {
  id: string;
  route: string;
  name: string;
  color: string;
  stationIds: string[];
}

export interface ModeNetworkSection {
  mode: TransitModeKey;
  label: string;
  branches: NetworkBranch[];
}

const STATION_LOOKUP: Record<string, Station> = Object.fromEntries(
  [...SYDNEY_STATIONS, ...NETWORK_EXTRA_STATIONS].map((s) => [s.id, s])
);

const GTFS_TO_FERRY_APP_ID: Record<string, string> =
  (ferryNetwork as { gtfsToAppId?: Record<string, string> }).gtfsToAppId ?? {};

export function getStationById(id: string): Station | undefined {
  const local = STATION_LOOKUP[id];
  if (local) return local;
  const ferryAppId = GTFS_TO_FERRY_APP_ID[id];
  if (ferryAppId && STATION_LOOKUP[ferryAppId]) return STATION_LOOKUP[ferryAppId];
  const gtfs = (transitNetworks as { stopsById?: Record<string, { name: string; lat: number; lon: number }> })
    .stopsById?.[id];
  if (gtfs?.name && typeof gtfs.lat === "number" && typeof gtfs.lon === "number") {
    return { id, name: gtfs.name, lat: gtfs.lat, lon: gtfs.lon, mode: "bus" } as Station;
  }
  return undefined;
}

export function resolveStationNames(ids: string[]): { id: string; name: string }[] {
  return ids.map((id) => ({
    id: GTFS_TO_FERRY_APP_ID[id] ?? id,
    name: getStationById(id)?.name ?? id.replace(/_/g, " "),
  }));
}

const METRO_BRANCHES: NetworkBranch[] = (metroNetwork.branches ?? []).map((b) => ({
  id: b.id,
  route: b.route,
  name: b.name,
  color: b.color,
  stationIds: b.stationIds,
}));

const LIGHTRAIL_BRANCHES: NetworkBranch[] = (lightRailNetwork.branches ?? []).map((b) => ({
  id: b.id,
  route: b.route,
  name: b.name,
  color: b.color,
  stationIds: b.stationIds,
}));

const FERRY_BRANCHES: NetworkBranch[] = (ferryNetwork.branches ?? []).map((b) => ({
  id: b.id,
  route: b.route,
  name: b.name,
  color: b.color,
  stationIds: b.stationIds,
}));

function trainBranchLabel(branch: { route: string; id: string }): string {
  const line = SYDNEY_TRAIN_LINES.find((l) => l.route === branch.route);
  const segment = branch.id
    .replace(`${branch.route}_`, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return line ? `${line.route} · ${segment}` : `${branch.route} · ${segment}`;
}

const TRAIN_BRANCHES: NetworkBranch[] = (
  trainNetwork.branches as Array<{ route: string; id: string; stationIds: string[] }>
).map((b) => {
  const line = SYDNEY_TRAIN_LINES.find((l) => l.route === b.route);
  return {
    id: b.id,
    route: b.route,
    name: trainBranchLabel(b),
    color: line?.color ?? "#F6891F",
    stationIds: b.stationIds,
  };
});

export const TRANSIT_NETWORK_SECTIONS: ModeNetworkSection[] = [
  { mode: "metro", label: "Metro", branches: METRO_BRANCHES },
  { mode: "train", label: "Trains", branches: TRAIN_BRANCHES },
  { mode: "lightrail", label: "Light rail", branches: LIGHTRAIL_BRANCHES },
  { mode: "ferry", label: "Ferries", branches: FERRY_BRANCHES },
];

export function getSectionForMode(mode: TransitModeKey): ModeNetworkSection | undefined {
  return TRANSIT_NETWORK_SECTIONS.find((s) => s.mode === mode);
}

/** Bus routes load on demand (large dataset). */
export async function getBusNetworkSection(): Promise<ModeNetworkSection> {
  const { getBusLineBranches } = await import("./busNetworks");
  const branches = await getBusLineBranches();
  return { mode: "bus", label: "Buses", branches };
}
