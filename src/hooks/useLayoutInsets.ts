import { useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { headerPaddingTop } from "../constants/design";
import {
  getStackContentClearance,
  getTabBarContentClearance,
  getTabBarHeight,
  getTabBarPaddingBottom,
  getToastBottomOffset,
} from "../constants/layout";

export function useLayoutInsets(options?: { tabScreen?: boolean }) {
  const insets = useSafeAreaInsets();
  const tabScreen = options?.tabScreen ?? false;

  return useMemo(
    () => ({
      insets,
      headerTop: headerPaddingTop(insets.top),
      tabBarHeight: getTabBarHeight(insets.bottom),
      tabBarPaddingBottom: getTabBarPaddingBottom(insets.bottom),
      tabContentBottomPadding: getTabBarContentClearance(insets.bottom),
      stackContentBottomPadding: getStackContentClearance(insets.bottom),
      scrollBottomPadding: tabScreen
        ? getTabBarContentClearance(insets.bottom)
        : getStackContentClearance(insets.bottom),
      toastBottom: getToastBottomOffset(insets.bottom, tabScreen),
      floatingBottom: getTabBarContentClearance(insets.bottom),
      keyboardVerticalOffset: Platform.OS === "ios" ? insets.top + 8 : 0,
    }),
    [insets.bottom, insets.top, tabScreen]
  );
}
