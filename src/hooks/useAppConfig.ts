import { useQuery } from "@tanstack/react-query";
import { fetchAppConfig } from "../services/appConfigService";

export function useAppConfig() {
  return useQuery({
    queryKey: ["appConfig"],
    queryFn: fetchAppConfig,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
