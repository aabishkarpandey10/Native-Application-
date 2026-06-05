import { SYDNEY_STATIONS } from "../constants/stations";
import { getLinesForStation, SYDNEY_TRAIN_LINES } from "../constants/trainNetworks";
import { buildLineStopSequence } from "../utils/trainStopSequence";
import type { Departure, ServiceAlert, TripItinerary } from "../services/tfnsw";
import {
  webAddRecentSearch,
  webCacheAlerts,
  webCacheDeparturesFromApi,
  webGetAlerts,
  webGetDepartures,
  webGetFavorites,
  webGetNearby,
  webGetRecentSearches,
  webGetStats,
  webGetTrips,
  webRemoveStation,
  webRemoveTrip,
  webSaveStation,
  webSaveTrip,
} from "./webStore";

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getStationsFromDb(query?: string) {
  if (!query) return SYDNEY_STATIONS;
  const q = query.toLowerCase();
  return SYDNEY_STATIONS.filter(
    (s) => s.name.toLowerCase().includes(q) || (s.code && s.code.toLowerCase().includes(q))
  );
}

export async function getDeparturesFromDb(stationId: string, limit = 10): Promise<Departure[]> {
  return webGetDepartures(stationId, limit);
}

export async function cacheDeparturesToDb(
  stationId: string,
  departures: Array<Record<string, unknown>>
) {
  await webCacheDeparturesFromApi(stationId, departures);
}

export async function getAlertsFromDb(): Promise<ServiceAlert[]> {
  return webGetAlerts();
}

export async function upsertAlertsToDb(alerts: ServiceAlert[]) {
  await webCacheAlerts(alerts);
}

export async function getNearbyFromDb(lat: number, lng: number, radius = 2000) {
  return webGetNearby(lat, lng, radius);
}

export async function getTripsFromDb(originId: string, destId: string): Promise<TripItinerary[]> {
  const orig = SYDNEY_STATIONS.find((s) => s.id === originId) || SYDNEY_STATIONS[0];
  const dest = SYDNEY_STATIONS.find((s) => s.id === destId) || SYDNEY_STATIONS[1];
  const now = new Date();
  const itineraries: TripItinerary[] = [];

  for (let i = 0; i < 3; i++) {
    const departureTime = new Date(now.getTime() + (5 + i * 12) * 60000);
    const linesForOrigin = orig.mode === "train" ? getLinesForStation(originId) : [];
    const line =
      linesForOrigin[i % Math.max(linesForOrigin.length, 1)] ||
      SYDNEY_TRAIN_LINES.find((l) => (orig.mode === "metro" ? l.route === "M1" : l.route.startsWith("T"))) ||
      SYDNEY_TRAIN_LINES[0];
    const perStop = orig.mode === "ferry" ? 5 : orig.mode === "train" ? 3 : 4;
    const lineStops =
      orig.mode === "train"
        ? buildLineStopSequence(
            originId,
            dest.name.replace(/ Station$/, ""),
            line.route,
            departureTime,
            perStop
          )
        : [];
    const stopNames =
      lineStops.length >= 2 ? lineStops.map((s) => s.station_name) : [orig.name, dest.name];
    const duration =
      lineStops.length >= 2
        ? (lineStops.length - 1) * perStop
        : Math.max(
            6,
            Math.round(
              haversine(orig.lat ?? -33.87, orig.lon ?? 151.21, dest.lat ?? -33.87, dest.lon ?? 151.21) /
                1000 /
                40 *
                60
            )
          );
    const arrivalTime = new Date(departureTime.getTime() + duration * 60000);

    itineraries.push({
      id: `db_trip_${i}_${originId}_${destId}`,
      duration,
      departureTime,
      arrivalTime,
      transfersCount: i === 2 ? 1 : 0,
      legs: [
        {
          mode: (orig.mode === "lightrail" ? "light_rail" : orig.mode) as TripItinerary["legs"][0]["mode"],
          departure: departureTime,
          arrival: arrivalTime,
          duration,
          stops: stopNames,
          platform: `Platform ${(i % 3) + 1}`,
          routeNumber: line.route,
        },
      ],
    });
  }
  return itineraries;
}

export async function getSavedStationsFromDb() {
  return webGetFavorites();
}

export async function saveStationToDb(station: {
  station_id: string;
  station_name: string;
  transit_mode: string;
}) {
  await webSaveStation(station);
}

export async function removeStationFromDb(stationId: string) {
  await webRemoveStation(stationId);
}

export async function getSavedTripsFromDb() {
  return webGetTrips();
}

export async function saveTripToDb(trip: {
  id: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  transit_mode: string;
  route_number?: string;
  description?: string;
  frequency?: string;
}) {
  await webSaveTrip(trip);
}

export async function removeTripFromDb(tripId: string) {
  await webRemoveTrip(tripId);
}

export async function addRecentSearchToDb(query: string) {
  await webAddRecentSearch(query);
}

export async function getRecentSearchesFromDb(): Promise<string[]> {
  return webGetRecentSearches();
}

export async function addTripHistory(_originId: string, _destId: string, _duration: number) {
  // no-op on web
}

export async function getDbStats() {
  return webGetStats();
}

export async function refreshDeparturesInDb(_stationId?: string, _stationIds?: string[]) {
  const { webRefreshDepartures } = await import("./webStore");
  await webRefreshDepartures();
}
