import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { normalizeStationId } from "../constants/stationAliases";
import { fetchDeparturesFeed } from "../services/tfnsw";
import { useRefreshIntervalMs } from "./useAppConfigRefresh";

export type UseDeparturesOptions = {
  /** Trips tab row preview — fewer network refetches */
  preview?: boolean;
  /** Rest-of-day timetable from Transport NSW PDF/GTFS + live overlay */
  fullDay?: boolean;
  /** Filter to one route (bus/light rail) */
  route?: string;
  enabled?: boolean;
};

export function useDepartures(
  stopId: string | null,
  count = 20,
  options: UseDeparturesOptions = {}
) {
  const { preview = false, fullDay = false, route, enabled = true } = options;
  const id = stopId ? normalizeStationId(stopId) : null;
  const queryClient = useQueryClient();
  const forceRefresh = useRef(false);
  const refreshMs = useRefreshIntervalMs("departures", preview ? 90_000 : 30_000);

  const query = useQuery({
    queryKey: [
      "departures",
      id,
      count,
      preview ? "preview" : "full",
      fullDay ? "day" : "board",
      route ?? "all",
    ],
    queryFn: async () => {
      const refresh = forceRefresh.current || fullDay;
      forceRefresh.current = false;
      return fetchDeparturesFeed(id!, count, { refresh, fullDay, route });
    },
    enabled: enabled && !!id,
    staleTime: fullDay ? 120_000 : preview ? 90_000 : 25_000,
    gcTime: 10 * 60_000,
    refetchInterval: preview ? false : refreshMs,
    refetchIntervalInBackground: !preview,
    refetchOnMount: preview ? false : "always",
    refetchOnWindowFocus: !preview,
    retry: preview ? 1 : 2,
    select: (feed) => feed,
  });

  const refetchFresh = useCallback(async () => {
    if (!id) return;
    forceRefresh.current = true;
    await query.refetch();
    void queryClient.invalidateQueries({ queryKey: ["departures", id] });
  }, [id, query, queryClient]);

  return { ...query, refetchFresh };
}
