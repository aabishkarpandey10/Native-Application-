import { useQuery } from "@tanstack/react-query";
import { fetchAppConfig } from "../services/appConfigService";
import { APP_CONFIG_DEFAULTS } from "../types/appConfig";

export function useAppConfig() {
  return useQuery({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    initialData: APP_CONFIG_DEFAULTS,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 2,
  });
}
