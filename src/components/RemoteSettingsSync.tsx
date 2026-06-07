import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppConfig } from "../hooks/useAppConfig";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { useStore } from "../store/store";
import { clearStationsCache } from "../services/stationsService";

/** Applies admin defaults (theme, notification default) when config loads from a live backend. */
export function RemoteSettingsSync() {
  const { data: config } = useAppConfig();
  const { data: backendStatus } = useBackendStatus();
  const queryClient = useQueryClient();
  const setTheme = useStore((s) => s.setTheme);
  const setEnableNotifications = useStore((s) => s.setEnableNotifications);
  const remoteSettingsApplied = useStore((s) => s.remoteSettingsApplied);
  const markRemoteSettingsApplied = useStore((s) => s.markRemoteSettingsApplied);
  const backendOnline = backendStatus?.ok === true;

  const adminSyncKey = useMemo(() => {
    if (!config || !backendOnline) return null;
    return [
      config.accentColor,
      config.defaultTheme,
      config.allowUserTheme,
      config.featureTripPlanner,
      config.featureMaps,
      config.featureAlerts,
      config.featureFavourites,
      config.featureAiChat,
      config.appName,
      config.showWalkLegsInTrips,
    ].join("|");
  }, [config, backendOnline]);

  useEffect(() => {
    if (!config || !backendOnline) return;

    if (!config.allowUserTheme) {
      setTheme(config.defaultTheme);
    }

    if (!remoteSettingsApplied && config.notificationsDefaultOn) {
      setEnableNotifications(true);
      markRemoteSettingsApplied();
    }
  }, [
    config,
    backendOnline,
    remoteSettingsApplied,
    setTheme,
    setEnableNotifications,
    markRemoteSettingsApplied,
  ]);

  useEffect(() => {
    if (!adminSyncKey) return;
    queryClient.invalidateQueries({ queryKey: ["stations"] });
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    clearStationsCache();
  }, [adminSyncKey, queryClient]);

  return null;
}
