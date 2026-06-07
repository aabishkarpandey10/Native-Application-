import { fetchBackendJson } from "./apiClient";
import { APP_CONFIG_DEFAULTS, normalizeAppConfig, type AppConfig } from "../types/appConfig";

export type { AppConfig };

export async function fetchAppConfig(): Promise<AppConfig> {
  try {
    const data = await fetchBackendJson<Partial<AppConfig>>("/api/app-config", {
      throwOnError: false,
    });
    return normalizeAppConfig(data ?? APP_CONFIG_DEFAULTS);
  } catch {
    return normalizeAppConfig(APP_CONFIG_DEFAULTS);
  }
}
