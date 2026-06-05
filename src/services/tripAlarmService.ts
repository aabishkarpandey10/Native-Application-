import { Platform } from "react-native";
import type { AlarmTrip } from "../store/store";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";
import { formatSydneyTime } from "../utils/tfnswTime";

type NotificationsMod = {
  scheduleNotificationAsync: (request: {
    identifier?: string;
    content: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
    };
    trigger: { date: Date } | null;
  }) => Promise<string>;
  cancelScheduledNotificationAsync: (identifier: string) => Promise<void>;
  getAllScheduledNotificationsAsync: () => Promise<{ identifier: string }[]>;
};

async function getNotificationsMod(): Promise<NotificationsMod | null> {
  if (!isNativeNotificationsSupported()) return null;
  try {
    return (await import("expo-notifications")) as unknown as NotificationsMod;
  } catch {
    return null;
  }
}

export function alarmNotificationId(alarmId: string): string {
  return `trip_alarm_${alarmId}`;
}

function shortName(name: string): string {
  return name.replace(/\s+Station$/i, "").replace(/\s+Wharf$/i, "").trim();
}

function computeWakeTime(alarm: AlarmTrip): Date {
  const depart = new Date(alarm.departAt);
  return new Date(depart.getTime() - alarm.leadMinutes * 60_000);
}

export async function scheduleTripAlarm(
  alarm: AlarmTrip
): Promise<{ ok: boolean; reason?: string }> {
  if (!alarm.enabled) {
    await cancelTripAlarm(alarm.id);
    return { ok: true };
  }

  const wakeAt = computeWakeTime(alarm);
  if (wakeAt.getTime() <= Date.now() + 30_000) {
    return { ok: false, reason: "Wake-up time is in the past. Choose a later departure." };
  }

  const mod = await getNotificationsMod();
  if (!mod) {
    return {
      ok: false,
      reason: "Trip alarms are available in the iOS and Android app.",
    };
  }

  const departLabel = formatSydneyTime(new Date(alarm.departAt), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const title = alarm.label?.trim() || "Trip alarm";
  const body = `Leave for ${shortName(alarm.origin_name)} → ${shortName(alarm.destination_name)}. Service around ${departLabel}.`;

  await cancelTripAlarm(alarm.id);
  await mod.scheduleNotificationAsync({
    identifier: alarmNotificationId(alarm.id),
    content: {
      title,
      body,
      data: { type: "trip_alarm", alarmId: alarm.id },
    },
    trigger: { date: wakeAt },
  });

  return { ok: true };
}

export async function cancelTripAlarm(alarmId: string): Promise<void> {
  const mod = await getNotificationsMod();
  if (!mod) return;
  try {
    await mod.cancelScheduledNotificationAsync(alarmNotificationId(alarmId));
  } catch {
    // ignore
  }
}

/** Re-apply all enabled alarms after app launch (IDs are stable). */
export async function syncAllTripAlarms(alarms: AlarmTrip[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const alarm of alarms) {
    if (alarm.enabled) {
      await scheduleTripAlarm(alarm).catch(() => null);
    }
  }
}
