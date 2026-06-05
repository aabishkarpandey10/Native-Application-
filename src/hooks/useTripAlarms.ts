import { useEffect } from "react";
import { useStore } from "../store/store";
import { syncAllTripAlarms } from "../services/tripAlarmService";
import { isNativeNotificationsSupported } from "../utils/notificationsPlatform";

/** Reschedule persisted trip alarms after app launch. */
export function useTripAlarms() {
  const alarmTrips = useStore((s) => s.alarmTrips);
  const enableNotifications = useStore((s) => s.enableNotifications);

  useEffect(() => {
    if (!isNativeNotificationsSupported() || !enableNotifications) return;
    void syncAllTripAlarms(alarmTrips);
  }, []);
}
