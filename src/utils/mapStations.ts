import type { MapStop } from "../components/transit-map";
import { SYDNEY_STATIONS, type Station } from "../constants/stations";

export function stationToMapStop(s: Station): MapStop {
  const mode =
    s.mode === "lightrail"
      ? "light_rail"
      : s.mode === "train" || s.mode === "metro" || s.mode === "bus" || s.mode === "ferry"
        ? s.mode
        : "train";
  return {
    station_id: s.id,
    station_name: s.name.replace(/\s+Station$/i, ""),
    latitude: s.lat,
    longitude: s.lon,
    transit_mode: mode,
  };
}

export function stationsForMapMode(mode: string): MapStop[] {
  const filter = (s: Station): boolean => {
    if (mode === "train" || mode === "metro") {
      return s.mode === "train" || s.mode === "metro";
    }
    if (mode === "bus") return s.mode === "bus";
    if (mode === "ferry") return s.mode === "ferry";
    if (mode === "lightrail") return s.mode === "lightrail";
    return s.mode === "train" || s.mode === "metro";
  };
  return SYDNEY_STATIONS.filter(filter).map(stationToMapStop);
}
