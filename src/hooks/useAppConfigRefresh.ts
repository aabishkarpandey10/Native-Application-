import { useAppConfig } from "./useAppConfig";

export function useRefreshIntervalMs(
  key: "alerts" | "departures" | "tripPlan",
  fallbackMs: number
): number {
  const { data } = useAppConfig();
  if (!data) return fallbackMs;
  const sec =
    key === "alerts"
      ? data.alertsRefreshSec
      : key === "departures"
        ? data.departuresRefreshSec
        : data.tripPlanRefreshSec;
  return Math.max(10, sec) * 1000;
}
