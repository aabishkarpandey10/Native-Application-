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
          hint: "Verify EXPO_PUBLIC_API_URL points to your deployed backend (set in Vercel/EAS before building)",
        });
      }
      return status;
    },
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
