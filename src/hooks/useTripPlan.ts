import { useCallback } from 'react';
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
  /** Full weekday timetable from service-day start (04:00) through end of day. */
  fullDay?: boolean;
  /** Bypass server cache. */
  forceRefresh?: boolean;
  /** When false, skips the query (for staged / background fetches). */
  enabled?: boolean;
};

export function useTripPlan(
  origin: string | null,
  destination: string | null,
  departure?: Date | null,
  options?: UseTripPlanOptions
) {
  const departAt = departure ?? new Date();
  const includePast = options?.includePast ?? false;
  const fullDay = options?.fullDay ?? false;
  const refreshMs = useRefreshIntervalMs('tripPlan', 15_000);
  const queryClient = useQueryClient();
  const timeKey = departAt.toISOString().slice(0, 16);

  const queryKey = [
    'tripPlan',
    origin,
    destination,
    options?.originId,
    options?.destinationId,
    timeKey,
    fullDay ? 'fullday' : includePast ? 'with-past' : 'upcoming',
  ] as const;

  const refetchFresh = useCallback(async () => {
    const fresh = await planTrip(origin!, destination!, departAt, {
      originId: options?.originId,
      destinationId: options?.destinationId,
      includePast,
      fullDay,
      forceRefresh: true,
    });
    queryClient.setQueryData(queryKey, fresh);
    return fresh;
  }, [
    departAt,
    destination,
    fullDay,
    includePast,
    options?.destinationId,
    options?.originId,
    origin,
    queryClient,
    queryKey,
  ]);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      planTrip(origin!, destination!, departAt, {
        originId: options?.originId,
        destinationId: options?.destinationId,
        includePast,
        fullDay,
      }),
    enabled: options?.enabled !== false && !!origin && !!destination,
    staleTime: fullDay || includePast ? 300_000 : 60_000,
    refetchInterval: fullDay || includePast ? false : refreshMs,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    retry: 1,
    gcTime: 600_000,
  });

  return {
    ...query,
    refetchFresh,
  };
}
