import { fetchBackendJson } from "./apiClient";
import { APP_CONFIG_DEFAULTS, normalizeAppConfig, type AppConfig } from "../types/appConfig";

export type { AppConfig };

export async function fetchAppConfig(): Promise<AppConfig> {
  const data = await fetchBackendJson<Partial<AppConfig>>("/api/app-config");
  return normalizeAppConfig(data ?? APP_CONFIG_DEFAULTS);
}
