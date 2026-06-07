import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "../config/api";
import { ApiRequestError, checkBackendHealth } from "../services/apiClient";

export function useBackendStatus() {
  return useQuery({
    queryKey: ["backendStatus"],
    queryFn: async () => {
      const status = await checkBackendHealth();
      if (!status?.ok) {
        throw new ApiRequestError("Backend health check failed", {
          path: "/api/health",
          url: getApiBaseUrl(),
          hint: "Verify EXPO_PUBLIC_API_URL was set before building the APK",
        });
      }
      return status;
    },
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
