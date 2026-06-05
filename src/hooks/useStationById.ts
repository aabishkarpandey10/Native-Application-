import { useQuery } from "@tanstack/react-query";
import { findStationById, fetchStationById } from "../services/stationsService";

export function useStationById(stationId: string | undefined) {
  return useQuery({
    queryKey: ["station", stationId],
    queryFn: () => fetchStationById(stationId!),
    enabled: !!stationId,
    staleTime: 10 * 60_000,
    initialData: () =>
      stationId ? findStationById(stationId) : undefined,
  });
}
