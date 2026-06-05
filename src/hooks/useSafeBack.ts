import { useCallback } from "react";
import { type Href, useNavigation, useRouter } from "expo-router";
import { navigationCanPop, type NavLike } from "../utils/navigationBack";

export type { NavLike };

const DEFAULT_FALLBACK: Href = "/(tabs)/favourites";

export function safeBack(
  router: ReturnType<typeof useRouter>,
  navigation: unknown,
  fallback: Href = DEFAULT_FALLBACK
) {
  const nav = navigation as NavLike | undefined;
  if (navigationCanPop(nav)) {
    nav!.goBack();
    return;
  }

  if (typeof router.canDismiss === "function" && router.canDismiss()) {
    router.dismiss();
    return;
  }

  router.replace(fallback);
}

/**
 * Navigate back when the stack can pop; otherwise replace with a safe tab root.
 * Avoids "POP / GO_BACK was not handled" when history is empty (common on web).
 */
export function useSafeBack(fallback: Href = DEFAULT_FALLBACK) {
  const router = useRouter();
  const navigation = useNavigation();

  return useCallback(() => {
    safeBack(router, navigation, fallback);
  }, [router, navigation, fallback]);
}
