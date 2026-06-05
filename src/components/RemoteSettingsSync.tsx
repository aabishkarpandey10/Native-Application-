import { useEffect } from "react";
import { useAppConfig } from "../hooks/useAppConfig";
import { useStore } from "../store/store";

/** Applies admin defaults (theme, notification default) when config loads. */
export function RemoteSettingsSync() {
  const { data: config } = useAppConfig();
  const setTheme = useStore((s) => s.setTheme);
  const setEnableNotifications = useStore((s) => s.setEnableNotifications);
  const remoteSettingsApplied = useStore((s) => s.remoteSettingsApplied);
  const markRemoteSettingsApplied = useStore((s) => s.markRemoteSettingsApplied);

  useEffect(() => {
    if (!config) return;

    if (!config.allowUserTheme) {
      setTheme(config.defaultTheme);
    }

    if (!remoteSettingsApplied && config.notificationsDefaultOn) {
      setEnableNotifications(true);
      markRemoteSettingsApplied();
    }
  }, [
    config,
    remoteSettingsApplied,
    setTheme,
    setEnableNotifications,
    markRemoteSettingsApplied,
  ]);

  return null;
}
