import type { Station } from "../constants/stations";

const MODE_KEYWORDS: Record<string, Station["mode"]> = {
  train: "train",
  trains: "train",
  metro: "metro",
  bus: "bus",
  buses: "bus",
  ferry: "ferry",
  ferries: "ferry",
  lightrail: "lightrail",
  "light rail": "lightrail",
  tram: "lightrail",
};

function matchesText(station: Station, text: string) {
  const t = text.toLowerCase();
  return (
    station.name.toLowerCase().includes(t) ||
    (station.code?.toLowerCase().includes(t) ?? false)
  );
}

/**
 * Search stations by name/code, or by mode keyword (e.g. "train", "metro", "train central").
 */
export function filterStationsByQuery(stations: Station[], query: string): Station[] {
  const q = query.trim().toLowerCase();
  if (!q) return stations;

  if (MODE_KEYWORDS[q]) {
    const mode = MODE_KEYWORDS[q];
    return stations.filter((s) => s.mode === mode);
  }

  const words = q.split(/\s+/).filter(Boolean);
  const firstWord = words[0];
  if (firstWord && MODE_KEYWORDS[firstWord]) {
    const mode = MODE_KEYWORDS[firstWord];
    const rest = words.slice(1).join(" ");
    return stations.filter((s) => {
      if (s.mode !== mode) return false;
      if (!rest) return true;
      return matchesText(s, rest);
    });
  }

  return stations.filter((s) => matchesText(s, q));
}

export function parseModeFromQuery(query: string): Station["mode"] | null {
  const q = query.trim().toLowerCase();
  return MODE_KEYWORDS[q] ?? null;
}
