export type LiveDepartureSummary = {
  route: string;
  destination: string;
  platform?: string;
  minutes: number;
  label: string;
  delayMinutes: number;
  scheduled: string;
};

export type LiveStopBoard = {
  station_id: string;
  station_name: string;
  mode: string;
  distance_meters?: number;
  source: string;
  next_departures: LiveDepartureSummary[];
};

export type LiveModeSection = {
  label: string;
  stops: LiveStopBoard[];
};

export type AssistantLiveBoard = {
  asOf: string;
  tfnswLive: boolean;
  dataSource: string;
  alertsSource?: string;
  byMode: Record<string, LiveModeSection>;
  favorites: LiveStopBoard[];
  alertsByMode?: Record<string, Array<{ title: string; severity: string; mode: string; description?: string }>>;
};

export const LIVE_MODE_ORDER = [
  { key: "train", mode: "train" as const, label: "Trains" },
  { key: "metro", mode: "metro" as const, label: "Metro" },
  { key: "lightrail", mode: "lightrail" as const, label: "Light rail" },
  { key: "ferry", mode: "ferry" as const, label: "Ferries" },
  { key: "bus", mode: "bus" as const, label: "Buses" },
];
