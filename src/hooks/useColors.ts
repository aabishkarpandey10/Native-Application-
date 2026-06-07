import { PALETTE, type Palette } from "../constants/design";
import { useStore } from "../store/store";
import { useAppConfig } from "./useAppConfig";

/** Returns the active palette + dark flag, driven by the persisted theme and admin accent. */
export function useColors(): Palette & { isDark: boolean } {
  const isDark = useStore((s) => s.theme) === "dark";
  const { data: config } = useAppConfig();
  const base = PALETTE[isDark ? "dark" : "light"];
  const accent = config?.accentColor?.trim();
  const primary =
    accent && /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : base.primary;
  return { ...base, primary, isDark };
}
