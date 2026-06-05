import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "../store/store";
import { fetchAlertsWithDb } from "../services/dataService";
import { useRefreshIntervalMs } from "./useAppConfigRefresh";
import { notifyLocalAlert } from "./usePushNotifications";

/** Background alert sync + local notifications (does not mount heavy alerts UI hooks). */
export function useAlertNotifications() {
  const enabled = useStore((s) => s.enableNotifications);
  const refreshMs = useRefreshIntervalMs("alerts", 30_000);
  const queryClient = useQueryClient();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const feed = await fetchAlertsWithDb(true);
        if (cancelled) return;
        queryClient.setQueryData(["alerts"], feed);
        useStore.getState().cacheAlerts(feed.alerts ?? []);

        const alerts = feed.alerts ?? [];
        if (!initializedRef.current) {
          alerts.forEach((a) => seenIdsRef.current.add(a.id));
          initializedRef.current = true;
          return;
        }

        for (const alert of alerts) {
          if (seenIdsRef.current.has(alert.id)) continue;
          seenIdsRef.current.add(alert.id);
          if (alert.severity === "critical" || alert.severity === "warning") {
            void notifyLocalAlert(alert.title, alert.description.slice(0, 180));
          }
        }
      } catch {
        // ignore background sync errors
      }
    };

    const delay = setTimeout(() => void sync(), 4000);
    const interval = setInterval(() => void sync(), refreshMs);

    return () => {
      cancelled = true;
      clearTimeout(delay);
      clearInterval(interval);
    };
  }, [enabled, queryClient, refreshMs]);
}
