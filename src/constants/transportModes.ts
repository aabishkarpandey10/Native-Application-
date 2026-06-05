/** Official Transport for NSW mode branding (circle icon + colour). */
export const TFNSW_MODE = {
  metro: { char: "M", color: "#00A9CE", label: "Metro" },
  train: { char: "T", color: "#F06724", label: "Train" },
  bus: { char: "B", color: "#00B5EF", label: "Bus" },
  ferry: { char: "F", color: "#008A44", label: "Ferry" },
  lightrail: { char: "L", color: "#E31837", label: "Light Rail" },
  light_rail: { char: "L", color: "#E31837", label: "Light Rail" },
  walk: { char: "W", color: "#71717A", label: "Walk" },
} as const;

export type TransportModeKey = keyof typeof TFNSW_MODE;

export function normalizeTransportMode(mode: string): TransportModeKey | null {
  const raw = String(mode ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!raw) return null;
  const compact = raw.replace(/_/g, "");
  if (compact === "lightrail") return "lightrail";
  if (raw in TFNSW_MODE) return raw as TransportModeKey;
  return null;
}

export function getModeConfig(mode: string) {
  const key = normalizeTransportMode(mode);
  if (key) return TFNSW_MODE[key];
  return { char: "?", color: "#52525B", label: String(mode || "Transit") };
}

export function getModeColor(mode: string): string {
  return getModeConfig(mode).color;
}

/** Modes shown on home screen quick-access grid. */
export const HOME_TRANSPORT_MODES = [
  { key: "train" as const, label: "Trains" },
  { key: "metro" as const, label: "Metro" },
  { key: "bus" as const, label: "Buses" },
  { key: "ferry" as const, label: "Ferries" },
  { key: "light_rail" as const, label: "Light Rail" },
];
