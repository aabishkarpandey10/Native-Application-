import trainNetwork from "./generated/trainNetwork.json";
import { SYDNEY_FERRY_WHARFS } from "./ferryNetworks";
import { SYDNEY_LIGHT_RAIL_STOPS } from "./lightRailNetworks";
import { SYDNEY_METRO_STATIONS } from "./metroNetworks";
import { NETWORK_EXTRA_STATIONS } from "./networkStations";

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  mode: "train" | "metro" | "bus" | "lightrail" | "ferry";
  code?: string;
  platform?: string;
}

const TRAIN_STATIONS: Station[] = trainNetwork.stations.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  mode: "train" as const,
  code: s.code,
}));

export const SYDNEY_STATIONS: Station[] = [
  ...TRAIN_STATIONS,
  ...SYDNEY_FERRY_WHARFS,
  ...SYDNEY_LIGHT_RAIL_STOPS,
  ...SYDNEY_METRO_STATIONS,
  ...NETWORK_EXTRA_STATIONS,
];
