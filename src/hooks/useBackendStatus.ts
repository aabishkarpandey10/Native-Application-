import { useQuery } from "@tanstack/react-query";
import { checkBackendHealth } from "../services/apiClient";

export function useBackendStatus() {
  return useQuery({
    queryKey: ["backendStatus"],
    queryFn: async () => {
      const status = await checkBackendHealth();
      if (!status?.ok) {
        return {
          ok: false,
          tfnswConfigured: false,
          tfnswLive: false,
          dataSource: "unavailable",
        };
      }
      return status;
    },
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
