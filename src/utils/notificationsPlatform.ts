import { Platform } from "react-native";

/** expo-notifications APIs are native-only; they throw on web. */
export function isNativeNotificationsSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}
