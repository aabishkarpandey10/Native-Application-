import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";
import { fetchBackendJson } from "./apiClient";

type NotificationsModule = {
  setNotificationHandler: (handler: {
    handleNotification: () => Promise<{
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner: boolean;
      shouldShowList: boolean;
    }>;
  }) => void;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  setNotificationChannelAsync: (
    id: string,
    channel: { name: string; importance: number; vibrationPattern: number[] }
  ) => Promise<void>;
  getExpoPushTokenAsync: (opts?: { projectId?: string }) => Promise<{ data: string }>;
  AndroidImportance: { HIGH: number };
};

let notificationsModule: NotificationsModule | null = null;

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (!isNativeNotificationsSupported()) return null;
  if (notificationsModule) return notificationsModule;
  try {
    const mod = (await import("expo-notifications")) as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationsModule = mod;
    return mod;
  } catch {
    return null;
  }
}

export async function registerForPushNotifications(accessToken?: string): Promise<string | null> {
  const mod = await getNotificationsModule();
  if (!mod) return null;

  if (!Device.isDevice) {
    console.warn("[Push] Simulator — push tokens unavailable");
    return null;
  }

  const { status: existing } = await mod.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await mod.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await mod.setNotificationChannelAsync("alerts", {
      name: "Service Alerts",
      importance: mod.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const tokenData = await mod.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const expoPushToken = tokenData.data;

  if (accessToken) {
    await fetchBackendJson("/api/v1/notifications/register", {
      method: "POST",
      throwOnError: false,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expoPushToken, commuteAlertsEnabled: true, subscribedRoutes: [] }),
    });
  }

  return expoPushToken;
}

export async function registerPushWithDevice(
  expoPushToken: string,
  deviceId?: string
): Promise<void> {
  await fetchBackendJson("/api/push/register", {
    method: "POST",
    throwOnError: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expoPushToken, deviceId, commuteAlertsEnabled: true }),
  });
}

export async function unregisterPushNotifications(
  expoPushToken: string,
  accessToken?: string
): Promise<void> {
  if (!accessToken) return;
  await fetchBackendJson("/api/v1/notifications/unregister", {
    method: "DELETE",
    throwOnError: false,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expoPushToken }),
  });
}
