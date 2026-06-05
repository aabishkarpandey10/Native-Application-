import { Platform } from "react-native";
import * as SplashScreen from "expo-splash-screen";

let preventReady = false;
let hideDone = false;

/** Call once at startup — required before hideAsync on native. */
export async function prepareNativeSplash(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await SplashScreen.preventAutoHideAsync();
    preventReady = true;
  } catch {
    preventReady = false;
  }
}

/** Hides the native splash once; no-op if unavailable (Expo Go, web, already hidden). */
export async function hideNativeSplash(): Promise<void> {
  if (Platform.OS === "web" || hideDone || !preventReady) return;
  hideDone = true;
  try {
    await SplashScreen.hideAsync();
  } catch {
    // e.g. "No native splash screen registered for given view controller"
  }
}
