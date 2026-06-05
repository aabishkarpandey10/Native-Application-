/**
 * Hardcoded sample data matching the redesign spec. Wired to the live backend
 * later; for now every screen renders from these fixtures.
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
  /** real clock label (e.g. "9:47"); when absent it's derived from `minutes` */
  clock?: string;
  /** ISO instant for live countdown refresh */
  departsAt?: string;
  delayed?: number; // minutes of delay
  occupancy?: "low" | "medium" | "high";
  /** from TfNSW API when live */
  lineColor?: string;
}

export interface SampleStation {
  id: string;
  name: string;
  distance: string;
  departures: SampleDeparture[];
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

export const NEARBY_STATIONS: SampleStation[] = [
  {
    id: "CENTRAL_T",
    name: "Central Station",
    distance: "50m",
    departures: [
      { id: "c1", route: "T4", destination: "Bondi Junction", via: "Museum, Kings Cross", platform: "23", minutes: 2, occupancy: "low" },
      { id: "c2", route: "T2", destination: "Parramatta", via: "Redfern, Newtown", platform: "20", minutes: 5, occupancy: "medium" },
      { id: "c3", route: "T1", destination: "Hornsby", via: "Strathfield, Epping", platform: "16", minutes: 8, delayed: 3, occupancy: "high" },
      { id: "c4", route: "T3", destination: "Liverpool", via: "Sydenham, Canterbury", platform: "19", minutes: 12, occupancy: "low" },
      { id: "c5", route: "T8", destination: "Airport & Wolli", via: "Wolli Creek", platform: "22", minutes: 16, occupancy: "medium" },
    ],
  },
  {
    id: "TOWNHALL_T",
    name: "Town Hall",
    distance: "800m",
    departures: [
      { id: "t1", route: "T2", destination: "Parramatta", via: "Central, Newtown", platform: "4", minutes: 4, occupancy: "medium" },
      { id: "t2", route: "T3", destination: "Bankstown", via: "Central, Sydenham", platform: "3", minutes: 7, occupancy: "low" },
      { id: "t3", route: "T4", destination: "Cronulla", via: "Wolli Creek", platform: "2", minutes: 11, occupancy: "low" },
    ],
  },
  {
    id: "CIRCULARQUAY_T",
    name: "Circular Quay",
    distance: "1.2km",
    departures: [
      { id: "q1", route: "T4", destination: "Bondi Junction", via: "Museum, Kings Cross", platform: "5", minutes: 6, occupancy: "low" },
      { id: "q2", route: "T8", destination: "Macarthur", via: "Airport, Wolli Creek", platform: "4", minutes: 9, occupancy: "medium" },
    ],
  },
];

/** Central Station live timetable (Timetable screen). */
export const TIMETABLE_CENTRAL: SampleDeparture[] = [
  { id: "1", route: "T4", destination: "Bondi Junction", via: "Museum, Kings Cross", platform: "23", minutes: 2, occupancy: "low" },
  { id: "2", route: "T2", destination: "Parramatta", via: "Redfern, Newtown", platform: "20", minutes: 5, occupancy: "medium" },
  { id: "3", route: "T1", destination: "Hornsby", via: "Strathfield, Epping", platform: "16", minutes: 8, delayed: 3, occupancy: "high" },
  { id: "4", route: "T3", destination: "Liverpool", via: "Sydenham, Canterbury", platform: "19", minutes: 12, occupancy: "low" },
  { id: "5", route: "T8", destination: "Airport & Wolli", via: "Wolli Creek", platform: "22", minutes: 16, occupancy: "medium" },
  { id: "6", route: "T4", destination: "Cronulla", via: "Wolli Creek", platform: "24", minutes: 19, occupancy: "low" },
  { id: "7", route: "M", destination: "Tallawong (Metro)", via: "Chatswood", platform: "1", minutes: 23, occupancy: "low" },
  { id: "8", route: "T2", destination: "Leppington", via: "Granville", platform: "17", minutes: 27, occupancy: "low" },
];

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
  /** Minutes until departure (TripView blue sidebar); negative = already left */
  leaveInMinutes?: number;
  isPast?: boolean;
  departureIso?: string;
  arrivalIso?: string;
  fastest?: boolean;
  changes: string; // "No changes" / "1 change"
  depart: string;
  arrive: string;
  fare: string;
  chips: JourneyLegChip[];
  steps: JourneyStep[];
  /** Full trip for detail sheet (intermediate stops). */
  itinerary?: TripItinerary;
  /** TfNSW live trip vs PDF timetable schedule. */
  isLive?: boolean;
}

export const JOURNEY_RESULTS: JourneyRoute[] = [
  {
    id: "r1",
    durationMin: 18,
    fastest: true,
    changes: "No changes",
    depart: "9:47",
    arrive: "10:05",
    fare: "$4.80",
    chips: [{ mode: "train", route: "T4" }],
    steps: [
      {
        mode: "train",
        route: "T4",
        label: "T4 to Bondi Junction",
        detail: "12 min · Platform 23",
      },
    ],
  },
  {
    id: "r2",
    durationMin: 27,
    changes: "1 change",
    depart: "9:52",
    arrive: "10:19",
    fare: "$4.80",
    chips: [
      { mode: "train", route: "T2" },
      { mode: "train", route: "T4" },
    ],
    steps: [
      { mode: "train", route: "T2", label: "T2 to Town Hall", detail: "6 min · Platform 20" },
      { mode: "train", route: "T4", label: "T4 to Bondi Junction", detail: "13 min · Platform 2" },
    ],
  },
];

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

export const SERVICE_ALERTS: SampleAlert[] = [
  {
    id: "a1",
    severity: "critical",
    route: "T3",
    lineName: "Bankstown Line",
    title: "Major Disruption",
    description: "Signal failure at Sydenham. Buses replacing trains between Sydenham and Bankstown.",
    time: "2h ago",
  },
  {
    id: "a2",
    severity: "warning",
    route: "T1",
    lineName: "North Shore Line",
    title: "Minor Delays",
    description: "Track work between Chatswood and Hornsby causing delays of up to 10 minutes.",
    time: "15m ago",
  },
  {
    id: "a3",
    severity: "info",
    route: "T4",
    lineName: "Eastern Suburbs Line",
    title: "Additional Services",
    description: "Extra services running during peak hours to accommodate increased demand.",
    time: "1h ago",
  },
  {
    id: "a4",
    severity: "success",
    route: "T2",
    lineName: "Inner West Line",
    title: "Service Restored",
    description: "Earlier delays have been cleared. All services are now running on time.",
    time: "3h ago",
  },
  {
    id: "a5",
    severity: "warning",
    route: "T8",
    lineName: "Airport Line",
    title: "Schedule Change",
    description: "Temporary timetable changes this weekend. Check trip planner before travelling.",
    time: "5h ago",
  },
];
