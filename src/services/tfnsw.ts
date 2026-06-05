import { Station } from "../constants/stations";
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
    options?: { refresh?: boolean; fullDay?: boolean }
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

  // 7. getMockData
  getMockData(type: 'departures' | 'alerts' | 'nearbyStops', stopId?: string): Departure[] | ServiceAlert[] | any[] {
    const now = new Date();
    if (type === 'departures') {
      return [
        {
          destination: "Newcastle",
          platform: "3",
          departureTime: new Date(now.getTime() + 4 * 60000),
          mode: "train",
          routeNumber: "T1",
          delayMinutes: 0,
          scheduledTime: new Date(now.getTime() + 4 * 60000),
          realTime: new Date(now.getTime() + 4 * 60000),
          lineColor: "#F6891F",
        },
        {
          destination: "Waterfall",
          platform: "5",
          departureTime: new Date(now.getTime() + 12 * 60000),
          mode: "train",
          routeNumber: "T4",
          delayMinutes: 0,
          scheduledTime: new Date(now.getTime() + 12 * 60000),
          realTime: new Date(now.getTime() + 12 * 60000),
          lineColor: "#E62B1E",
        },
        {
          destination: "Strathfield",
          platform: "2",
          departureTime: new Date(now.getTime() + 18 * 60000),
          mode: "train",
          routeNumber: "T8",
          delayMinutes: 0,
          scheduledTime: new Date(now.getTime() + 18 * 60000),
          realTime: new Date(now.getTime() + 18 * 60000),
          lineColor: "#009374",
        },
      ];
    }

    if (type === 'alerts') {
      return [
        {
          id: "alert_t1",
          mode: "train",
          title: "T1 Western Line Trackwork",
          description: "Buses replace trains between Penrith and St Marys due to planned trackwork.",
          severity: "warning",
          affectedRoutes: ["T1"],
          expiresAt: new Date(now.getTime() + 8 * 3600000),
        },
        {
          id: "alert_l2",
          mode: "light_rail",
          title: "L2 Randwick Light Rail Delay",
          description: "Delays due to an incident at Surry Hills.",
          severity: "critical",
          affectedRoutes: ["L2"],
        },
      ];
    }

    return [];
  }

  private generateMockItineraries(orig: Station, dest: Station, date: Date): TripItinerary[] {
    const list: TripItinerary[] = [];
    for (let i = 0; i < 3; i++) {
      const departureTime = new Date(date.getTime() + (5 + i * 15) * 60000);
      const duration = 15;
      const arrivalTime = new Date(departureTime.getTime() + duration * 60000);
      list.push({
        id: `mock_trip_${i}`,
        duration,
        departureTime,
        arrivalTime,
        legs: [
          {
            mode: orig.mode === "lightrail" ? "light_rail" : (orig.mode as any),
            departure: departureTime,
            arrival: arrivalTime,
            duration,
            stops: [orig.name, dest.name],
            platform: "Platform 3",
            routeNumber: orig.mode === "train" ? "T1" : "M1",
          },
        ],
      });
    }
    return list;
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
export const getMockData = tfnswService.getMockData.bind(tfnswService);
export const getVehiclePositions = tfnswService.getVehiclePositions.bind(tfnswService);
export type { VehiclePosition as TfNswVehiclePosition };
