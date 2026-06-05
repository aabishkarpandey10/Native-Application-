import { SYDNEY_STATIONS, type Station } from "../constants/stations";

function norm(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+station$/i, "")
    .replace(/\s+wharf.*$/i, "")
    .replace(/\s+metro$/i, "")
    .replace(/\s+light rail$/i, "")
    .trim();
}

/** Match user input ("Central", "Parramatta") to a known station record. */
export function resolveStationByName(
  text: string,
  stations: Station[] = SYDNEY_STATIONS
): Station | null {
  const q = norm(text);
  if (!q) return null;

  const exact = stations.filter((s) => norm(s.name) === q);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    const metro = exact.find((s) => s.mode === "metro");
    if (metro && /metro/i.test(text)) return metro;
    const train = exact.find((s) => s.mode === "train");
    return train ?? exact[0];
  }

  const starts = stations.filter(
    (s) => norm(s.name).startsWith(q) || q.startsWith(norm(s.name))
  );
  if (starts.length === 1) return starts[0];
  if (starts.length > 1) {
    if (/metro/i.test(text)) return starts.find((s) => s.mode === "metro") ?? starts[0];
    return starts.find((s) => s.mode === "train") ?? starts[0];
  }

  const includes = stations.filter(
    (s) => norm(s.name).includes(q) || q.includes(norm(s.name))
  );
  if (includes.length === 0) return null;
  if (/metro/i.test(text)) return includes.find((s) => s.mode === "metro") ?? includes[0];
  return includes.find((s) => s.mode === "train") ?? includes[0];
}

export function resolveStationName(text: string): string | null {
  return resolveStationByName(text)?.name ?? null;
}
