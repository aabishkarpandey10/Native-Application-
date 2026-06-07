import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { headerPaddingTop, safeBottomInset } from "../constants/design";
import {
  getChatInputClearance,
  getStackContentClearance,
  getTabBarContentClearance,
  getToastBottomOffset,
  getTripFooterClearance,
} from "../constants/layout";

type ScreenChromeOptions = {
  tabScreen?: boolean;
  /** Stack screen with fixed chat input bar (assistant). */
  chatInput?: boolean;
  /** Stack screen with fixed trip footer bar (trip-results). */
  tripFooter?: boolean;
};

/** Shared safe-area + scroll clearance — one source for web and Expo Go. */
export function useScreenChrome(options?: ScreenChromeOptions) {
  const insets = useSafeAreaInsets();
  const tabScreen = options?.tabScreen ?? false;
  const chatInput = options?.chatInput ?? false;
  const tripFooter = options?.tripFooter ?? false;

  return useMemo(() => {
    let contentBottomPadding = tabScreen
      ? getTabBarContentClearance(insets.bottom)
      : getStackContentClearance(insets.bottom);
    if (chatInput) contentBottomPadding = getChatInputClearance(insets.bottom);
    if (tripFooter) contentBottomPadding = getTripFooterClearance(insets.bottom);

    return {
      insets,
      headerTop: headerPaddingTop(insets.top),
      safeBottom: safeBottomInset(insets.bottom),
      contentBottomPadding,
      toastBottom: getToastBottomOffset(insets.bottom, tabScreen),
    };
  }, [chatInput, insets.bottom, insets.top, tabScreen, tripFooter]);
}
