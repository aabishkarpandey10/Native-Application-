import { useQuery } from '@tanstack/react-query';
import { fetchNearbyStops } from '../services/tfnsw';

export function useNearbyStops(
  latitude: number | null,
  longitude: number | null,
  radius: number = 1200
) {
  return useQuery({
    queryKey: ['nearbyStops', latitude, longitude],
    queryFn: () => fetchNearbyStops(latitude!, longitude!, radius),
    enabled: latitude !== null && longitude !== null,
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}
