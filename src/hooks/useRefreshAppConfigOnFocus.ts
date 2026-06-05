import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchAppConfig } from "../services/appConfigService";

/** Refetch branding/config when screen gains focus (e.g. after admin logo upload). */
export function useRefreshAppConfigOnFocus() {
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      void queryClient.fetchQuery({
        queryKey: ["appConfig"],
        queryFn: fetchAppConfig,
      });
    }, [queryClient])
  );
}
