import { PALETTE, type Palette } from "../constants/design";
import { useStore } from "../store/store";

/** Returns the active palette + dark flag, driven by the persisted theme. */
export function useColors(): Palette & { isDark: boolean } {
  const isDark = useStore((s) => s.theme) === "dark";
  return { ...PALETTE[isDark ? "dark" : "light"], isDark };
}
