const MODE_KEYWORDS = {
  train: "train",
  trains: "train",
  metro: "metro",
  bus: "bus",
  buses: "bus",
  ferry: "ferry",
  ferries: "ferry",
  lightrail: "lightrail",
  "light rail": "lightrail",
};

function matchesText(station, text) {
  const t = text.toLowerCase();
  return (
    station.name.toLowerCase().includes(t) ||
    (station.code && station.code.toLowerCase().includes(t))
  );
}

export function filterStationsByQuery(stations, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return stations;

  if (MODE_KEYWORDS[q]) {
    const mode = MODE_KEYWORDS[q];
    return stations.filter((s) => s.mode === mode);
  }

  const words = q.split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first && MODE_KEYWORDS[first]) {
    const mode = MODE_KEYWORDS[first];
    const rest = words.slice(1).join(" ");
    return stations.filter((s) => {
      if (s.mode !== mode) return false;
      if (!rest) return true;
      return matchesText(s, rest);
    });
  }

  return stations.filter((s) => matchesText(s, q));
}
