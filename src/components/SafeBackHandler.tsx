import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { navigationCanPop } from "../utils/navigationBack";
import { safeBack } from "../hooks/useSafeBack";

/** Hardware / browser back — never POP on an empty stack. */
export function SafeBackHandler() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        safeBack(router, navigation);
        return true;
      });
      return () => sub.remove();
    }

    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const onPopState = () => {
      if (!navigationCanPop(navigation)) {
        safeBack(router, navigation);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router, navigation]);

  return null;
}
