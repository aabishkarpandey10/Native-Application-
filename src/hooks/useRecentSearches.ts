import { useQuery } from "@tanstack/react-query";
import { getRecentSearchesFromDb } from "../database/repository";

export function useRecentSearches() {
  return useQuery<string[]>({
    queryKey: ["recentSearches"],
    queryFn: getRecentSearchesFromDb,
    staleTime: 60000,
  });
}
