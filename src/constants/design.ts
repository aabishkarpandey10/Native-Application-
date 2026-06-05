/**
 * TripView-inspired design tokens for Sydney Transit (iOS + Android).
 * Blue header bars, grouped table views, NSW line colours.
 */

export type ThemeMode = "light" | "dark";

export interface Palette {
  bg: string;
  card: string;
  border: string;
  /** TripView-style header / accent blue */
  primary: string;
  header: string;
  headerText: string;
  text: string;
  textSecondary: string;
  muted: string;
  barBg: string;
  /** UITableView-style separator */
  separator: string;
}

export const PALETTE: Record<ThemeMode, Palette> = {
  light: {
    bg: "#EFEFF4",
    card: "#FFFFFF",
    border: "#C6C6C8",
    primary: "#0079C1",
    header: "#0079C1",
    headerText: "#FFFFFF",
    text: "#000000",
    textSecondary: "#6D6D72",
    muted: "#EFEFF4",
    barBg: "rgba(255,255,255,0.92)",
    separator: "#C6C6C8",
  },
  dark: {
    bg: "#000000",
    card: "#1C1C1E",
    border: "#38383A",
    primary: "#0A84FF",
    header: "#0A84FF",
    headerText: "#FFFFFF",
    text: "#FFFFFF",
    textSecondary: "#98989D",
    muted: "#2C2C2E",
    barBg: "rgba(28,28,30,0.92)",
    separator: "#38383A",
  },
};

export const SEMANTIC = {
  destructive: "#FF3B30",
  success: "#34C759",
  warning: "#FF9500",
  info: "#007AFF",
} as const;

/** NSW Transport line colours (exact hex per brand). */
export const LINE_COLORS: Record<string, string> = {
  T1: "#F6891F",
  T2: "#0098CD",
  T3: "#F37021",
  T4: "#005AA3",
  T5: "#C4258F",
  T6: "#717678",
  T7: "#6F818E",
  T8: "#00954C",
  T9: "#D11F2F",
  M: "#F7941D",
  M1: "#F7941D",
  METRO: "#F7941D",
  F1: "#00A14B",
  L1: "#BE1622",
  L2: "#E31837",
  L3: "#E31837",
  L4: "#E31837",
  L5: "#E31837",
};

export function lineColor(route?: string): string {
  if (!route) return "#6D6D72";
  const key = route.trim().toUpperCase();
  return LINE_COLORS[key] ?? LINE_COLORS[key.replace(/[^A-Z0-9]/g, "")] ?? "#6D6D72";
}

/** TripView-style countdown colours (green / amber / red). */
export function countdownColor(minutes: number, delayed = false): string {
  if (delayed || minutes <= 1) return SEMANTIC.destructive;
  if (minutes <= 4) return SEMANTIC.warning;
  return SEMANTIC.success;
}

/** Inter on all platforms — matches web typography. */
export const FONT = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

/** Hairline borders / separators (web + iOS style on Android too). */
export const HAIRLINE = 0.5;

export const SPACING = {
  screen: 16,
  section: 12,
  row: 12,
} as const;

export const MIN_TOUCH = 44;

export const RADIUS = {
  card: 10,
  button: 8,
  pill: 999,
  badge: 3,
} as const;

/** Tab bar height (content area, excluding safe area). */
export const TAB_BAR_HEIGHT = 56;

type Weight = "400" | "500" | "600" | "700" | "800";

export function interFamily(weight: Weight = "400"): string {
  switch (weight) {
    case "500":
      return FONT.medium;
    case "600":
      return FONT.semibold;
    case "700":
      return FONT.bold;
    case "800":
      return FONT.extrabold;
    default:
      return FONT.regular;
  }
}

/** Screen / nav titles — same weight on web and native. */
export function titleWeight(): Weight {
  return "600";
}
