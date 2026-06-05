import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { fetchAlertsWithDb, type AlertsFeed } from "../services/dataService";
import { useStore } from "../store/store";
import { useRefreshIntervalMs } from "./useAppConfigRefresh";

export type UseServiceAlertsOptions = {
  /** When false, skips network (use cached store / stale query data). */
  enabled?: boolean;
};

export function useServiceAlerts(options: UseServiceAlertsOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const refreshMs = useRefreshIntervalMs("alerts", 30_000);
  const cachedAlerts = useStore((s) => s.alerts);

  const query = useQuery({
    queryKey: ["alerts", "live"],
    queryFn: () => fetchAlertsWithDb(true),
    enabled,
    staleTime: 0,
    gcTime: 15 * 60_000,
    refetchInterval: enabled ? refreshMs : false,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
    placeholderData: () =>
      cachedAlerts.length
        ? {
            alerts: cachedAlerts,
            meta: {
              asOf: null,
              source: "cached" as const,
              tfnswLive: false,
              count: cachedAlerts.length,
            },
          }
        : undefined,
  });

  const refetchFromTfnsw = useCallback(async (): Promise<AlertsFeed> => {
    const fresh = await fetchAlertsWithDb(true);
    queryClient.setQueryData(["alerts"], fresh);
    return fresh;
  }, [queryClient]);

  const feed = query.data;

  useEffect(() => {
    const list = feed?.alerts ?? [];
    const activeIds = new Set(list.map((a) => a.id));
    for (const id of [...seenIdsRef.current]) {
      if (!activeIds.has(id)) seenIdsRef.current.delete(id);
    }
    if (list.length) {
      useStore.getState().cacheAlerts(list);
    }
  }, [feed?.alerts]);

  return {
    alerts: feed?.alerts ?? cachedAlerts,
    meta: feed?.meta,
    seenIdsRef,
    isLoading: query.isLoading && !cachedAlerts.length,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    refetchFromTfnsw,
  };
}
