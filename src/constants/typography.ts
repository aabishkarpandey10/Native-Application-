import { Platform, type TextStyle } from "react-native";
import { FONT } from "./fonts";

type Weight = "400" | "500" | "600" | "700" | "800";

let interAvailable = true;

/** Called from root layout after expo-font loads Inter (or fails). */
export function setInterFontsAvailable(available: boolean) {
  interAvailable = available;
}

const ANDROID_SYSTEM: Record<Weight, string> = {
  "400": "sans-serif",
  "500": "sans-serif-medium",
  "600": "sans-serif-medium",
  "700": "sans-serif-bold",
  "800": "sans-serif-black",
};

export function resolveFontFamily(weight: Weight = "400"): string {
  if (!interAvailable && Platform.OS !== "web") {
    if (Platform.OS === "android") return ANDROID_SYSTEM[weight];
    return "System";
  }

  switch (weight) {
    case "500":
      return FONT.medium;
    case "600":
      return FONT.semibold;
    case "700":
      return FONT.bold;
    case "800":
      return FONT.extrabold;
    default:
      return FONT.regular;
  }
}

/** Inter files embed weight — pairing fontWeight on Android causes synthetic bold / clipped text. */
export function resolveTextStyle(weight: Weight = "400"): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  const fontFamily = resolveFontFamily(weight);

  if (Platform.OS === "android" && interAvailable) {
    return { fontFamily };
  }

  return {
    fontFamily,
    fontWeight: weight as TextStyle["fontWeight"],
  };
}
