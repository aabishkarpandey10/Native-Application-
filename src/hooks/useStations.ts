import { useQuery } from "@tanstack/react-query";
import {
  fetchCoreStationsFromApi,
  fetchStations,
  setStationsCache,
  type StationFetchOptions,
} from "../services/stationsService";

export function useStations(mode?: string) {
  const isBus = mode === "bus";

  return useQuery({
    queryKey: ["stations", "core", mode ?? "all"],
    queryFn: async () => {
      if (isBus) return [];
      const list = await fetchCoreStationsFromApi();
      setStationsCache(list);
      return list;
    },
    enabled: !isBus,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function useBusStationSearch(
  search: string,
  options: { lat?: number; lng?: number; enabled?: boolean } = {}
) {
  const q = search.trim();
  const hasCoords = options.lat != null && options.lng != null;

  const searchReady = q.length >= 2;

  return useQuery({
    queryKey: ["stations", "bus", q, options.lat, options.lng],
    queryFn: () => {
      if (searchReady) {
        return fetchStations({ mode: "bus", query: q, limit: 50 });
      }
      if (hasCoords) {
        return fetchStations({
          mode: "bus",
          lat: options.lat,
          lng: options.lng,
          limit: 80,
        });
      }
      return fetchStations({ mode: "bus", popular: true });
    },
    enabled: options.enabled !== false && (searchReady || hasCoords || q.length === 0),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useStationsSearch(options: StationFetchOptions & { enabled?: boolean }) {
  const { enabled = true, ...fetchOpts } = options;
  return useQuery({
    queryKey: ["stations", "search", fetchOpts],
    queryFn: () => fetchStations(fetchOpts),
    enabled,
    staleTime: 30_000,
  });
}
