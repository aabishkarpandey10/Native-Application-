import { useQuery, useQueryClient } from '@tanstack/react-query';
import { planTrip } from '../services/tfnsw';
import type { TripItinerary } from '../services/tfnsw';
import { useRefreshIntervalMs } from './useAppConfigRefresh';

export type TripPlanStationIds = {
  originId?: string;
  destinationId?: string;
};

export type UseTripPlanOptions = TripPlanStationIds & {
  /** Include earlier trips today (slower full-day timetable). */
  includePast?: boolean;
};

export function useTripPlan(
  origin: string | null,
  destination: string | null,
  departure?: Date | null,
  options?: UseTripPlanOptions
) {
  const departAt = departure ?? new Date();
  const includePast = options?.includePast ?? false;
  const refreshMs = useRefreshIntervalMs('tripPlan', 15_000);
  const queryClient = useQueryClient();
  const timeKey = departAt.toISOString().slice(0, 16);

  const upcomingKey = [
    'tripPlan',
    origin,
    destination,
    options?.originId,
    options?.destinationId,
    timeKey,
    'upcoming',
  ] as const;

  return useQuery({
    queryKey: [
      'tripPlan',
      origin,
      destination,
      options?.originId,
      options?.destinationId,
      timeKey,
      includePast ? 'with-past' : 'upcoming',
    ],
    queryFn: () =>
      planTrip(origin!, destination!, departAt, {
        originId: options?.originId,
        destinationId: options?.destinationId,
        includePast,
      }),
    enabled: !!origin && !!destination,
    staleTime: includePast ? 120_000 : 60_000,
    refetchInterval: includePast ? false : refreshMs,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    retry: 1,
    placeholderData: () => {
      if (!includePast) return undefined;
      return queryClient.getQueryData<TripItinerary[]>(upcomingKey);
    },
  });
}
