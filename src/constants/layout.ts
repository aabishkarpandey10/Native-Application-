import { Platform } from "react-native";

/** Inner tab bar content (icon + label). */
export const TAB_BAR_INNER_HEIGHT = 56;
export const TAB_BAR_TOP_PADDING = 6;

/** Horizontal padding used on most screens. */
export const SCREEN_HORIZONTAL_PADDING = 20;

/** Scroll content bottom padding (tab screens — tab bar is outside content). */
export const TAB_SCROLL_BOTTOM_PADDING = 24;

/** Scroll content bottom padding (stack / modal screens). */
export const STACK_SCROLL_BOTTOM_PADDING = Platform.select({ ios: 32, android: 28, default: 32 }) ?? 32;

/** Minimum touch target (Apple HIG / Material). */
export const MIN_TOUCH_TARGET = Platform.select({ ios: 44, android: 48, default: 44 }) ?? 44;

export function getTabBarHeight(bottomInset: number): number {
  const safeBottom = Math.max(bottomInset, Platform.OS === "android" ? 8 : 0);
  return TAB_BAR_INNER_HEIGHT + TAB_BAR_TOP_PADDING + safeBottom;
}

export function getTabBarPaddingBottom(bottomInset: number): number {
  return Math.max(bottomInset, Platform.OS === "android" ? 8 : 0);
}

/** Toast offset above tab bar. */
export function getToastBottomOffset(bottomInset: number, hasTabBar = true): number {
  if (!hasTabBar) return bottomInset + 16;
  return getTabBarHeight(bottomInset) + 8;
}
