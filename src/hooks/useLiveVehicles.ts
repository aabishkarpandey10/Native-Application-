import { useQuery } from "@tanstack/react-query";
import { fetchLiveVehicles } from "../services/dataService";

export type UseLiveVehiclesOptions = {
  lat?: number;
  lng?: number;
  mode?: string;
  route?: string;
  radiusM?: number;
  limit?: number;
  enabled?: boolean;
  /** Poll interval (ms). Default 20s. */
  refetchInterval?: number;
};

function normalizeApiMode(mode?: string): string | undefined {
  if (!mode || mode === "all") return undefined;
  if (mode === "lightrail") return "light_rail";
  return mode;
}

export function useLiveVehicles(options: UseLiveVehiclesOptions) {
  const lat = options.lat;
  const lng = options.lng;
  const hasCenter = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  return useQuery({
    queryKey: [
      "live-vehicles",
      lat,
      lng,
      options.mode,
      options.route,
      options.radiusM,
      options.limit,
    ],
    queryFn: () =>
      fetchLiveVehicles({
        lat: lat!,
        lng: lng!,
        mode: normalizeApiMode(options.mode),
        route: options.route,
        radiusM: options.radiusM,
        limit: options.limit,
      }),
    enabled: options.enabled !== false && hasCenter,
    staleTime: 12_000,
    refetchInterval: options.refetchInterval ?? 20_000,
    refetchOnWindowFocus: false,
  });
}
