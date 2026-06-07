import {
  fetchAlertsWithDb,
  fetchDeparturesWithDb,
  type DeparturesFeed,
  fetchNearbyWithDb,
  planTripWithDb,
} from "./dataService";

export interface Departure {
  destination: string;
  platform: string;
  departureTime: Date;
  mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  routeNumber: string;
  vehiclePosition?: { lat: number; lng: number };
  delayMinutes?: number;
  // Compatibility fields
  scheduledTime?: Date;
  realTime?: Date | null;
  lineColor?: string;
  lineName?: string;
  stops?: { station_name: string; time: Date; delayedTime?: Date }[];
}

export interface ServiceAlert {
  id: string;
  mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  affectedRoutes: string[];
  expiresAt?: Date;
  updatedAt?: string;
  announcementType?: string | null;
  isTrackwork?: boolean;
  isCritical?: boolean;
  url?: string | null;
}

export interface TripLeg {
  mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry' | 'walk';
  departure: Date;
  arrival: Date;
  duration: number; // minutes
  stops: string[];
  stopTimes?: { station_name: string; time: Date; lat?: number; lon?: number }[];
  originName?: string;
  destinationName?: string;
  originStopId?: string;
  destinationStopId?: string;
  platform?: string;
  destinationPlatform?: string;
  walkingDistance?: number; // meters
  routeNumber?: string;
}

export interface TripItinerary {
  id: string;
  duration: number; // minutes
  legs: TripLeg[];
  departureTime: Date;
  arrivalTime: Date;
  transfersCount?: number;
  /** True when sourced from TfNSW live trip API (estimated times). */
  isLive?: boolean;
}

export interface VehiclePosition {
  id: string;
  routeNumber: string;
  mode: 'train' | 'metro' | 'bus' | 'light_rail' | 'ferry';
  lat: number;
  lon: number;
  bearing?: number;
  speed?: number;
  occupancy?: string;
}

class TfNswService {
  // 1. fetchDepartures
  async fetchDepartures(stopId: string, count: number = 10): Promise<Departure[]> {
    const feed = await fetchDeparturesWithDb(stopId, count);
    return feed.departures;
  }

  async fetchDeparturesFeed(
    stopId: string,
    count: number = 10,
    options?: { refresh?: boolean; fullDay?: boolean; route?: string }
  ): Promise<DeparturesFeed> {
    return fetchDeparturesWithDb(stopId, count, options);
  }

  // 2. fetchServiceAlerts
  async fetchServiceAlerts(): Promise<ServiceAlert[]> {
    const feed = await fetchAlertsWithDb();
    return feed.alerts;
  }

  // 3. fetchNearbyStops
  async fetchNearbyStops(lat: number, lng: number, radius: number = 2000): Promise<any[]> {
    return fetchNearbyWithDb(lat, lng, radius);
  }

  // 4. planTrip
  async planTrip(
    origin: string,
    destination: string,
    departure: Date,
    options?: import("./dataService").PlanTripOptions
  ): Promise<TripItinerary[]> {
    return planTripWithDb(origin, destination, departure, options);
  }

  // 5. parseGTFSRealtime
  parseGTFSRealtime(buffer: ArrayBuffer): any {
    return {
      trip_updates: [],
      vehicle_positions: [],
      alerts: [],
    };
  }

  // 6. getVehiclePositions — live GTFS-RT via backend (Transport NSW)
  async getVehiclePositions(
    mode: string,
    center?: { lat: number; lng: number },
    route?: string
  ): Promise<VehiclePosition[]> {
    const lat = center?.lat ?? -33.8688;
    const lng = center?.lng ?? 151.2093;
    const { fetchLiveVehicles } = await import("./dataService");
    const feed = await fetchLiveVehicles({
      lat,
      lng,
      mode: mode === "all" ? undefined : mode,
      route,
      radiusM: 15_000,
    });
    return feed.vehicles;
  }
}

export const tfnswService = new TfNswService();
export default tfnswService;
export const fetchDepartures = tfnswService.fetchDepartures.bind(tfnswService);
export const fetchDeparturesFeed = tfnswService.fetchDeparturesFeed.bind(tfnswService);
export const fetchServiceAlerts = tfnswService.fetchServiceAlerts.bind(tfnswService);
export const fetchNearbyStops = tfnswService.fetchNearbyStops.bind(tfnswService);
export const planTrip = tfnswService.planTrip.bind(tfnswService);
export const parseGTFSRealtime = tfnswService.parseGTFSRealtime.bind(tfnswService);
export const getVehiclePositions = tfnswService.getVehiclePositions.bind(tfnswService);
export type { VehiclePosition as TfNswVehiclePosition };
