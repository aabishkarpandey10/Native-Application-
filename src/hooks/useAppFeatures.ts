import { useAppConfig } from "./useAppConfig";

/** Remote feature flags from admin → /api/app-config */
export function useAppFeatures() {
  const { data: config } = useAppConfig();

  return {
    tripPlanner: config?.featureTripPlanner !== false,
    maps: config?.featureMaps !== false,
    alerts: config?.featureAlerts !== false,
    favourites: config?.featureFavourites !== false,
    aiChat: config?.featureAiChat !== false,
    maintenance: config?.maintenanceMode === true,
    maintenanceMessage:
      config?.maintenanceMessage ?? "Maintenance mode — some live data may be unavailable",
  };
}
