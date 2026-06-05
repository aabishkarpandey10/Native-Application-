import { Platform } from "react-native";
import { TransitMap as TransitMapNative } from "./TransitMap.native";
import { TransitMap as TransitMapWeb } from "./TransitMap.web";
import type { TransitMapProps } from "./TransitMap.web";

export function TransitMap(props: TransitMapProps) {
  if (Platform.OS === "web") {
    return <TransitMapWeb {...props} />;
  }
  return <TransitMapNative {...props} />;
}

export type { MapStop, TransitMapProps } from "./TransitMap.web";
