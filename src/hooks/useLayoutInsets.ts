import { useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTabBarHeight,
  getTabBarPaddingBottom,
  getToastBottomOffset,
  STACK_SCROLL_BOTTOM_PADDING,
  TAB_SCROLL_BOTTOM_PADDING,
} from "../constants/layout";

export function useLayoutInsets(options?: { tabScreen?: boolean }) {
  const insets = useSafeAreaInsets();
  const tabScreen = options?.tabScreen ?? false;

  return useMemo(
    () => ({
      insets,
      tabBarHeight: getTabBarHeight(insets.bottom),
      tabBarPaddingBottom: getTabBarPaddingBottom(insets.bottom),
      scrollBottomPadding: tabScreen ? TAB_SCROLL_BOTTOM_PADDING : STACK_SCROLL_BOTTOM_PADDING,
      toastBottom: getToastBottomOffset(insets.bottom, tabScreen),
      /** For floating UI on map tab (above tab bar). */
      floatingBottom: TAB_SCROLL_BOTTOM_PADDING,
      keyboardVerticalOffset: Platform.OS === "ios" ? insets.top + 8 : 0,
    }),
    [insets.bottom, insets.top, tabScreen]
  );
}
