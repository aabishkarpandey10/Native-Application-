import type { WatchSettings } from "../store/store";
import { shortStationName } from "./tripViewFormat";

const COMPLICATION_LABELS: Record<WatchSettings["complication"], string> = {
  next_departure: "Next departure",
  nearest: "Nearest stop",
  saved_trip: "Saved trip",
  trip_alarm: "Trip alarm",
};

export function watchComplicationLabel(complication: WatchSettings["complication"]): string {
  return COMPLICATION_LABELS[complication];
}

/** Short summary for Tools → Watch Settings row. */
export function watchSettingsToolsValue(
  settings: WatchSettings,
  favorites: { station_id: string; station_name: string }[]
): string | undefined {
  if (!settings.syncEnabled) return "Off";
  const base = watchComplicationLabel(settings.complication);
  if (settings.complication !== "next_departure") return base;
  const fav = favorites.find((f) => f.station_id === settings.primaryStopId);
  if (fav) return shortStationName(fav.station_name);
  return base;
}
