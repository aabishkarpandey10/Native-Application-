import type { TripLeg } from "../services/tfnsw";
import { parseTfnswTime } from "./tfnswTime";

function asDate(value: string | Date | number | null | undefined): Date {
  if (value instanceof Date) return value;
  return parseTfnswTime(value);
}

export function isTransitLeg(leg: TripLeg): boolean {
  return leg.mode !== "walk";
}

export function transitLegs(legs: TripLeg[]): TripLeg[] {
  return legs.filter(isTransitLeg);
}

/** Trip summary for UI. Walking legs optional (admin setting). Times use transit only. */
export function trainOnlyTripSummary(legs: TripLeg[], options?: { includeWalk?: boolean }) {
  const transit = transitLegs(legs);
  const displayLegs = options?.includeWalk ? legs : transit;

  if (transit.length === 0) {
    return {
      legs: displayLegs,
      durationMin: 0,
      transfers: 0,
      departure: null as Date | null,
      arrival: null as Date | null,
    };
  }

  const boardLeg = transit[0];
  const alightLeg = transit[transit.length - 1];
  const departure = asDate(boardLeg.departure);
  const arrival = asDate(alightLeg.arrival);
  const durationMin =
    Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / 60000)) ||
    transit.reduce((sum, leg) => sum + (leg.duration ?? 0), 0);
  const transfers = Math.max(0, transit.length - 1);

  return { legs: displayLegs, durationMin, transfers, departure, arrival };
}
