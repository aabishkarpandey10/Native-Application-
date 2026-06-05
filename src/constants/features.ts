/** Production feature flags — set in .env / EAS secrets */
export const FEATURES = {
  /** In-app admin console (dev or explicit enable) */
  admin:
    __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ADMIN === "true",
  /** AI assistant screen */
  assistant:
    __DEV__ || process.env.EXPO_PUBLIC_ENABLE_ASSISTANT === "true",
} as const;
