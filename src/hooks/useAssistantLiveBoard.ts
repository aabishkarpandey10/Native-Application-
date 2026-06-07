import { useQuery } from "@tanstack/react-query";
import { fetchBackendJson } from "../services/apiClient";
import type { AssistantLiveBoard } from "../types/assistantLive";
import type { SavedStation } from "../store/store";

export function useAssistantLiveBoard(
  lat: number | undefined,
  lng: number | undefined,
  favorites: SavedStation[]
) {
  return useQuery({
    queryKey: ["assistant-live-board", lat, lng, favorites.map((f) => f.station_id).join(",")],
    queryFn: async (): Promise<AssistantLiveBoard> => {
      const params = new URLSearchParams({
        lat: String(lat ?? -33.8688),
        lng: String(lng ?? 151.2093),
        favorites: JSON.stringify(favorites.slice(0, 6)),
      });
      const data = await fetchBackendJson<AssistantLiveBoard>(
        `/api/ai/live-board?${params}`
      );
      if (!data) throw new Error("Live board unavailable");
      return data;
    },
    enabled: true,
    refetchInterval: 30_000,
    staleTime: 15_000,
    refetchOnMount: "always",
  });
}
