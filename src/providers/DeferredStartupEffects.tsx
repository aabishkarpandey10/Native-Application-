import { Platform } from "react-native";
import { LocationWatcher } from "../components/LocationWatcher";
import { useAlertNotifications } from "../hooks/useAlertNotifications";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useTripAlarms } from "../hooks/useTripAlarms";

function NativeDeferredEffects() {
  usePushNotifications();
  useAlertNotifications();
  useTripAlarms();
  return <LocationWatcher />;
}

/** Runs after first paint so Expo Go startup stays responsive. */
export function DeferredStartupEffects() {
  if (Platform.OS === "web") {
    return null;
  }
  return <NativeDeferredEffects />;
}
