/**
 * Display-layer types for departures, alerts, and trip results.
 * Live data comes from the Express API — no hardcoded fixtures in this file.
 */

import type { TripItinerary } from "../services/tfnsw";
import { formatSydneyTime } from "../utils/tfnswTime";

export interface SampleDeparture {
  id: string;
  route: string;
  destination: string;
  platform: string;
  via?: string;
  minutes: number;
  clock?: string;
  departsAt?: string;
  delayed?: number;
  occupancy?: "low" | "medium" | "high";
  lineColor?: string;
  transitMode?: string;
  platformLabel?: string;
}

/** Compute a Sydney clock label `H:MM` for a departure `minutes` from now. */
export function clockFromNow(minutes: number): string {
  return formatSydneyTime(new Date(Date.now() + minutes * 60000), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .replace(/\s*(AM|PM)$/i, "")
    .trim();
}

export interface JourneyLegChip {
  mode: string;
  route?: string;
}

export interface JourneyStep {
  mode: string;
  route?: string;
  label: string;
  detail: string;
}

export interface JourneyRoute {
  id: string;
  durationMin: number;
  leaveInMinutes?: number;
  isPast?: boolean;
  departureIso?: string;
  arrivalIso?: string;
  fastest?: boolean;
  changes: string;
  depart: string;
  arrive: string;
  fare: string;
  chips: JourneyLegChip[];
  steps: JourneyStep[];
  itinerary?: TripItinerary;
  isLive?: boolean;
}

export type Severity = "critical" | "warning" | "info" | "success";

export interface SampleAlert {
  id: string;
  severity: Severity;
  route: string;
  lineName: string;
  title: string;
  description: string;
  time: string;
}
