/** Production feature flags — set in .env / EAS secrets */
export const FEATURES = {
  /**
   * In-app admin console — never shown in UI.
   * Set EXPO_PUBLIC_ENABLE_ADMIN=true for operator builds, then unlock via
   * Settings → tap Version 7×. Default operator UI is the web panel at /admin.
   */
  admin: process.env.EXPO_PUBLIC_ENABLE_ADMIN === "true",
  /** AI assistant screen */
  assistant:
    __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ASSISTANT === "true",
} as const;

/** Consecutive taps on Settings → Version required to open in-app admin. */
export const ADMIN_UNLOCK_TAP_COUNT = 7;
