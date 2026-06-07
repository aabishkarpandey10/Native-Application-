import { SPACING, safeBottomInset } from "./design";

/** Inner tab bar content (icon + label). */
export const TAB_BAR_INNER_HEIGHT = 56;
export const TAB_BAR_TOP_PADDING = 6;

/** Floating pill height inside TripViewTabBar (minHeight 58 + paddingVertical 5×2). */
export const TAB_BAR_PILL_HEIGHT = 68;

/** Gap between scroll content and floating tab pill — matches TripViewTabBar outer +12. */
export const TAB_BAR_FLOAT_GAP = 16;

/** Horizontal padding used on most screens — matches SPACING.screen. */
export const SCREEN_HORIZONTAL_PADDING = SPACING.screen;

/** Extra scroll padding below tab content. */
export const TAB_SCROLL_BOTTOM_PADDING = 24;

/** Extra scroll padding on stack / modal screens — same on web and mobile. */
export const STACK_SCROLL_BOTTOM_PADDING = 32;

/** Minimum touch target — same on web and mobile. */
export const MIN_TOUCH_TARGET = 44;

/** Fixed chat input composer (assistant). */
export const CHAT_INPUT_BAR_HEIGHT = 68;

/** Fixed trip-results footer bar (above safe area). */
export const TRIP_FOOTER_BAR_HEIGHT = 54;

export function getTabBarHeight(bottomInset: number): number {
  const safeBottom = safeBottomInset(bottomInset);
  return TAB_BAR_PILL_HEIGHT + safeBottom;
}

export function getTabBarPaddingBottom(bottomInset: number): number {
  return safeBottomInset(bottomInset);
}

/** Scroll bottom clearance on tab screens (floating tab bar + safe area). */
export function getTabBarContentClearance(bottomInset: number): number {
  return TAB_BAR_PILL_HEIGHT + TAB_BAR_FLOAT_GAP + safeBottomInset(bottomInset);
}

/** Scroll bottom clearance on stack / modal screens. */
export function getStackContentClearance(bottomInset: number): number {
  return STACK_SCROLL_BOTTOM_PADDING + safeBottomInset(bottomInset);
}

/** Scroll clearance above assistant chat input bar. */
export function getChatInputClearance(bottomInset: number): number {
  return CHAT_INPUT_BAR_HEIGHT + safeBottomInset(bottomInset) + SPACING.screen;
}

/** Scroll clearance above trip-results fixed footer. */
export function getTripFooterClearance(bottomInset: number): number {
  return TRIP_FOOTER_BAR_HEIGHT + safeBottomInset(bottomInset) + SPACING.section;
}

/** Toast offset above tab bar. */
export function getToastBottomOffset(bottomInset: number, hasTabBar = true): number {
  if (!hasTabBar) return safeBottomInset(bottomInset) + 16;
  return getTabBarContentClearance(bottomInset) - 12;
}
