import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * expo-notifications is native-only and unavailable in Expo Go (SDK 53+).
 * Use a development build for push and scheduled local notifications.
 */
export function isNativeNotificationsSupported(): boolean {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (Constants.appOwnership === "expo") return false;
  return true;
}
