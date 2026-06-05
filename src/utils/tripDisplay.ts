import type { TripLeg } from "../services/tfnsw";
import type { JourneyRoute } from "../constants/sampleData";
import { getModeColor } from "../constants/transportModes";
import { getRouteHexColor } from "./transitColors";
import { parseTfnswTime } from "./tfnswTime";

export const TRIPVIEW_BLUE = "#0079C1";

export interface TripLegChip {
  mode: string;
  route?: string;
}

function asDate(value: string | Date | number | null | undefined): Date {
  if (value instanceof Date) return value;
  return parseTfnswTime(value);
}

export function normalizeTripMode(mode?: string): string {
  const m = String(mode ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (m === "lightrail") return "light_rail";
  return m || "train";
}

export function legAccentColor(leg: Pick<TripLeg, "mode" | "routeNumber">): string {
  return getRouteHexColor(leg.mode, leg.routeNumber);
}

export function chipAccentColor(chip: TripLegChip): string {
  return getRouteHexColor(chip.mode, chip.route);
}

export function tripAccentColor(
  chips: TripLegChip[],
  requestedMode?: string
): string {
  const req = normalizeTripMode(requestedMode);
  if (req === "light_rail") return getModeColor("light_rail");
  if (req === "metro") return getModeColor("metro");
  if (req === "ferry") return getModeColor("ferry");
  if (req === "bus") return getModeColor("bus");

  if (chips.length > 0) {
    const modes = chips.map((c) => normalizeTripMode(c.mode));
    if (modes.every((m) => m === "light_rail")) return getModeColor("light_rail");
    if (modes.every((m) => m === "metro")) return getModeColor("metro");
    if (modes.every((m) => m === "ferry")) return getModeColor("ferry");
    if (modes.every((m) => m === "bus")) return getModeColor("bus");
    return chipAccentColor(chips[0]);
  }

  return TRIPVIEW_BLUE;
}

export function formatRouteCodes(chips: TripLegChip[]): string {
  const codes = chips
    .map((c) => c.route || normalizeTripMode(c.mode).replace("_", " ").toUpperCase())
    .filter(Boolean);
  return codes.length ? codes.join(" → ") : "—";
}

export function resolveTripDisplayMode(
  route: JourneyRoute,
  requestedMode?: string,
  fromId?: string,
  toId?: string
): string {
  const req = normalizeTripMode(requestedMode);
  if (req === "light_rail") return "light_rail";
  const chipMode = route.chips[0]?.mode;
  if (chipMode) {
    const modes = route.chips.map((c) => normalizeTripMode(c.mode));
    if (modes.every((m) => m === "light_rail")) return "light_rail";
    return normalizeTripMode(chipMode);
  }
  if (/_LR$/i.test(fromId ?? "") || /_LR$/i.test(toId ?? "")) return "light_rail";
  return req || "train";
}

export function legModeLabel(mode: string, route?: string): string {
  const m = normalizeTripMode(mode);
  const code = route?.trim();
  if (m === "light_rail") return code ? `${code} Light Rail` : "Light Rail";
  if (m === "metro") return code ? `${code} Metro` : "Metro";
  if (m === "ferry") return code ? `${code} Ferry` : "Ferry";
  if (m === "bus") return code ? `${code} Bus` : "Bus";
  return code || "Train";
}

export function transferWaitMinutes(prevLeg: TripLeg, nextLeg: TripLeg): number {
  const wait = Math.round(
    (asDate(nextLeg.departure).getTime() - asDate(prevLeg.arrival).getTime()) / 60000
  );
  return Math.max(0, wait);
}
