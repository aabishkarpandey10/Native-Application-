import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";
import { useStore } from "../store/store";
import {
  registerForPushNotifications,
  registerPushWithDevice,
} from "../services/pushNotificationService";
import { fetchBackendJson } from "../services/apiClient";

function getDeviceId(): string {
  return (
    Constants.installationId ??
    Constants.sessionId ??
    `expo-${Constants.expoConfig?.slug ?? "sydney-transit"}`
  );
}

type NotificationsMod = {
  scheduleNotificationAsync: (content: {
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: null;
  }) => Promise<string>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
};

async function getNotificationsMod(): Promise<NotificationsMod | null> {
  if (!isNativeNotificationsSupported()) return null;
  try {
    return (await import("expo-notifications")) as unknown as NotificationsMod;
  } catch {
    return null;
  }
}

async function unregisterDevicePushToken(token: string): Promise<void> {
  await fetchBackendJson("/api/push/unregister", {
    method: "DELETE",
    throwOnError: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken: token, deviceId: getDeviceId() }),
  }).catch(() => {});
}

/** Sync push registration with Settings toggle */
export function usePushNotifications() {
  const enabled = useStore((s) => s.enableNotifications);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!enabled) {
        if (tokenRef.current) {
          await unregisterDevicePushToken(tokenRef.current);
          tokenRef.current = null;
        }
        const mod = await getNotificationsMod();
        await mod?.cancelAllScheduledNotificationsAsync();
        return;
      }

      const token = await registerForPushNotifications();
      if (cancelled) return;
      tokenRef.current = token;

      if (token) {
        await registerPushWithDevice(token, getDeviceId()).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}

/** Fire a local notification for a new critical alert (foreground-friendly) */
export async function notifyLocalAlert(title: string, body: string) {
  const mod = await getNotificationsMod();
  if (!mod) return;
  await mod.scheduleNotificationAsync({
    content: { title, body, data: { type: "service_alert" } },
    trigger: null,
  });
}
