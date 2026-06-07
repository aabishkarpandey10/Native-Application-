/**
 * TripView-inspired design tokens — same look on iOS, Android, and web.
 */

import { StyleSheet, type ViewStyle } from "react-native";

export type ThemeMode = "light" | "dark";

export interface Palette {
  bg: string;
  card: string;
  border: string;
  primary: string;
  header: string;
  headerText: string;
  text: string;
  textSecondary: string;
  muted: string;
  barBg: string;
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

export function countdownColor(minutes: number, delayed = false): string {
  if (delayed || minutes <= 1) return SEMANTIC.destructive;
  if (minutes <= 4) return SEMANTIC.warning;
  return SEMANTIC.success;
}

export function scheduleCountdownStyle(
  minutes: number,
  delayed = false,
  isDark = false
): { bg: string; border: string; fg: string } {
  if (delayed || minutes <= 1) {
    return {
      bg: isDark ? "#3B1F1F" : "#FEF2F2",
      border: isDark ? "#7F1D1D" : "#FECACA",
      fg: SEMANTIC.destructive,
    };
  }
  if (minutes <= 5) {
    return {
      bg: isDark ? "#3B2F1A" : "#FFFBEB",
      border: isDark ? "#92400E" : "#FDE68A",
      fg: SEMANTIC.warning,
    };
  }
  return {
    bg: isDark ? "#2C2C2E" : "#EFEFF4",
    border: isDark ? "#38383A" : "#C6C6C8",
    fg: isDark ? "#98989D" : "#6D6D72",
  };
}

export { FONT } from "./fonts";

export const HAIRLINE = StyleSheet.hairlineWidth;

export const APP_SHELL_WIDTH = 430;

export const SAFE_BOTTOM_MIN = 8;
export const HEADER_TOP_EXTRA = 0;
export const HEADER_BODY_MIN_HEIGHT = 52;
export const HEADER_SIDE_WIDTH = 72;
export const SCREEN_TITLE_SIZE = 17;
export const NAV_TITLE_SIZE = 17;
export const SCHEDULE_TITLE_SIZE = 22;

export function headerPaddingTop(statusBarInset: number): number {
  return statusBarInset + HEADER_TOP_EXTRA;
}

export function safeBottomInset(bottomInset: number): number {
  return Math.max(bottomInset, SAFE_BOTTOM_MIN);
}

export const SPACING = {
  screen: 16,
  cell: 16,
  section: 12,
  row: 12,
  iconGap: 14,
} as const;

export const LIST_TRANSPORT_SEPARATOR = SPACING.cell + 36 + SPACING.iconGap;
export const LIST_ICON_SEPARATOR = SPACING.cell + 46 + SPACING.iconGap;
export const ROW_ICON_SIZE = 28;
export const LIST_ROW_SEPARATOR = SPACING.cell + ROW_ICON_SIZE + SPACING.iconGap;
export const LIST_ROW_HEIGHT = 56;

export const MIN_TOUCH = 44;

export const RADIUS = {
  card: 10,
  button: 10,
  pill: 999,
  badge: 3,
  sm: 8,
} as const;

export function cardShadow(_isDark: boolean): ViewStyle {
  return {};
}

export function tabBarShadow(isDark: boolean): ViewStyle {
  return isDark
    ? {
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }
    : {
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      };
}

export const TAB_BAR_HEIGHT = 56;

type Weight = "400" | "500" | "600" | "700" | "800";

export { resolveFontFamily as interFamily, resolveTextStyle, setInterFontsAvailable } from "./typography";

export function titleWeight(): Weight {
  return "600";
}
