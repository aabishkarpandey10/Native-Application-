import {
  cacheDeparturesToDb,
  getDeparturesFromDb,
  upsertAlertsToDb,
} from "../database/repository";
import { resolveStationByName } from "../utils/resolveStation";
import { SYDNEY_STATIONS, type Station } from "../constants/stations";
import { normalizeStationId } from "../constants/stationAliases";
import type { Departure, ServiceAlert, TripItinerary, VehiclePosition } from "./tfnsw";
import {
  ensureStationsLoaded,
  fetchStationById,
  findStationById,
  getStationsSync,
} from "./stationsService";
import { parseTfnswTime, toIsoString } from "../utils/tfnswTime";
import { dedupeAlerts, isActiveServiceAlert, mapRawAlert } from "../utils/serviceAlert";
import { assertLiveDataSource, fetchBackendJson } from "./apiClient";
import { getRouteHexColor } from "../utils/transitColors";

function mapApiDeparture(item: Record<string, unknown>): Departure {
  const schedTime = parseTfnswTime(
    (item.scheduledTime ?? item.scheduled_time) as string
  );
  const delay = Number(item.delayMinutes ?? item.delay_minutes ?? 0) || 0;
  const realTimeRaw = item.realTime ?? item.real_time;
  const realTime = realTimeRaw
    ? parseTfnswTime(realTimeRaw as string)
    : new Date(schedTime.getTime() + delay * 60000);
  const mode = item.mode === "lightrail" ? "light_rail" : (item.mode as Departure["mode"]);
  const routeNumber = String(item.routeNumber ?? item.route_number ?? "—");
  const lineColor =
    (item.lineColor as string) ||
    (item.line_color as string) ||
    getRouteHexColor(mode, routeNumber);
  return {
    destination: item.destination as string,
    platform: (item.platform as string) || "—",
    departureTime: realTime,
    mode,
    routeNumber,
    delayMinutes: delay,
    scheduledTime: schedTime,
    realTime,
    lineColor,
    lineName: (item.lineName as string) || (item.line_name as string) || routeNumber,
    stops: item.stops
      ? (item.stops as Array<{ station_name: string; time: string }>).map((st) => ({
          station_name: st.station_name,
          time: parseTfnswTime(st.time),
        }))
      : undefined,
  };
}

async function expectedModeForStation(
  stationId: string,
  stations: Station[] = getStationsSync()
): Promise<string | null> {
  const id = normalizeStationId(stationId);
  let station = stations.find((s) => s.id === id);
  if (!station) station = await fetchStationById(id);
  if (!station) return null;
  return station.mode === "lightrail" ? "light_rail" : station.mode;
}

async function filterDeparturesByStationMode(
  stationId: string,
  items: Record<string, unknown>[],
  stations: Station[] = getStationsSync()
): Promise<Record<string, unknown>[]> {
  const expected = await expectedModeForStation(stationId, stations);
  if (!expected) return items;
  return items.filter((item) => {
    const raw = item.mode as string;
    const mode = raw === "lightrail" ? "light_rail" : raw;
    const route = String(item.routeNumber ?? item.route_number ?? "");
    const productClass = item._productClass as number | undefined;

    if (expected === "train") {
      if (mode === "metro" || productClass === 2 || /^M\d/i.test(route)) return false;
      if (
        mode === "train" ||
        productClass === 1 ||
        /^T\d/i.test(route) ||
        /^(CCN|BMT|SCO|HUN|SPL)$/i.test(route)
      ) {
        return true;
      }
      return false;
    }
    if (expected === "metro") {
      if (mode === "train" && productClass === 1 && !/^M\d/i.test(route)) return false;
      if (mode === "metro" || productClass === 2 || /^M\d/i.test(route)) return true;
      return false;
    }

    if (mode === expected) return true;
    if (expected === "ferry" && /^F\d+/i.test(route)) return true;
    if (expected === "train" && /^T\d+/i.test(route)) return true;
    if (expected === "metro" && /^M\d+/i.test(route)) return true;
    if (expected === "light_rail" && /^L\d+/i.test(route)) return true;
    if (expected === "bus") {
      if (mode === "bus" || productClass === 5 || productClass === 7) return true;
      if (/^\d{1,4}[A-Z]?$/i.test(route) || /^X\d+/i.test(route)) return true;
    }
    return false;
  });
}

function unwrapDeparturesPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { departures?: unknown }).departures)) {
    return (data as { departures: Record<string, unknown>[] }).departures;
  }
  return [];
}

function mapNearbyStop(raw: Record<string, unknown>) {
  const nd = raw.next_departure ?? raw.nextDeparture;
  return {
    station_id: String(raw.station_id),
    station_name: String(raw.station_name),
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
    transit_mode: String(raw.transit_mode),
    distance_meters: Number(raw.distance_meters),
    next_departure: nd ? mapApiDeparture(nd as Record<string, unknown>) : null,
  };
}

export type DeparturesFeed = {
  departures: Departure[];
  source: string | null;
};

export async function fetchDeparturesWithDb(
  stopId: string,
  count = 10,
  options?: { refresh?: boolean; fullDay?: boolean; route?: string }
): Promise<DeparturesFeed> {
  const stationId = normalizeStationId(stopId);
  await ensureStationsLoaded();
  const stations = getStationsSync();

  const params = new URLSearchParams({ stationId });
  if (options?.refresh) params.set("refresh", "1");
  if (options?.fullDay) params.set("fullDay", "1");
  if (options?.route?.trim()) params.set("route", options.route.trim());
  const data = await fetchBackendJson<{ source?: string; departures?: unknown[] } | unknown[]>(
    `/api/departures?${params.toString()}`,
    { timeoutMs: options?.fullDay ? 60_000 : 15_000 }
  );
  const source =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data.source as string) ?? null
      : null;
  assertLiveDataSource(source, `/api/departures?stationId=${stationId}`);
  const rawList = unwrapDeparturesPayload(data);
  const trustBackendSchedule =
    source === "timetable-pdf" ||
    source === "timetable-pdf-weekday" ||
    source === "timetable-pdf-fullday" ||
    source === "tfnsw-live" ||
    source === "tfnsw-live-fullday" ||
    source === "tfnsw-live+timetable-pdf" ||
    source === "tfnsw-live+timetable-pdf-fullday" ||
    source === "tfnsw-live+timetable-fullday" ||
    source === "tfnsw-live+timetable-gtfs" ||
    source === "tfnsw-live+timetable-gtfs-fullday" ||
    source === "unavailable" ||
    source === "cached";
  let list = trustBackendSchedule
    ? rawList
    : await filterDeparturesByStationMode(stationId, rawList, stations);
  if (!trustBackendSchedule && rawList.length > 0 && list.length === 0) {
    list = rawList;
  }
  list = [...list].sort((a, b) => {
    const ta = parseTfnswTime(
      (a.realTime ?? a.real_time ?? a.scheduledTime ?? a.scheduled_time) as string
    ).getTime();
    const tb = parseTfnswTime(
      (b.realTime ?? b.real_time ?? b.scheduledTime ?? b.scheduled_time) as string
    ).getTime();
    return ta - tb;
  });

  const apiResponded =
    data !== null && (Array.isArray(data) || (typeof data === "object" && "source" in data));

  if (list.length > 0) {
    await cacheDeparturesToDb(stationId, list);
    const cap = options?.fullDay ? list.length : count;
    return {
      departures: list.slice(0, cap).map((item) => mapApiDeparture(item)),
      source,
    };
  }

  if (apiResponded) {
    return { departures: [], source };
  }

  // Full-day timetable is large — do not fall back to a short live-board SQLite cache.
  if (options?.fullDay) {
    return { departures: [], source };
  }

  const cached = await getDeparturesFromDb(stationId, count);
  return { departures: cached, source: cached.length > 0 ? "cached" : source };
}

export type AlertsFeedMeta = {
  asOf: string | null;
  source: string | null;
  tfnswLive: boolean;
  count: number;
  trackworkCount?: number;
  criticalCount?: number;
};

export type AlertsFeed = {
  alerts: ServiceAlert[];
  meta: AlertsFeedMeta;
};

type AlertsApiPayload = {
  alerts?: Record<string, unknown>[];
  asOf?: string;
  source?: string;
  tfnswLive?: boolean;
  count?: number;
  trackworkCount?: number;
  criticalCount?: number;
};

function buildMeta(
  data: Record<string, unknown>[] | AlertsApiPayload | null,
  alertCount: number
): AlertsFeedMeta {
  if (!data || Array.isArray(data)) {
    return {
      asOf: null,
      source: Array.isArray(data) ? "legacy" : null,
      tfnswLive: false,
      count: alertCount,
    };
  }
  return {
    asOf: data.asOf ?? null,
    source: data.source ?? null,
    tfnswLive: !!data.tfnswLive,
    count: data.count ?? alertCount,
    trackworkCount: data.trackworkCount,
    criticalCount: data.criticalCount,
  };
}

async function cacheAlertsSafe(alerts: ServiceAlert[]) {
  try {
    await upsertAlertsToDb(alerts);
  } catch (err) {
    console.warn("[alerts] SQLite cache skipped:", err);
  }
}

const MAX_CLIENT_ALERTS = 100;

export async function fetchAlertsWithDb(forceRefresh = true): Promise<AlertsFeed> {
  const path = forceRefresh ? "/api/alerts?refresh=1" : "/api/alerts";
  const data = await fetchBackendJson<Record<string, unknown>[] | AlertsApiPayload>(path, {
    timeoutMs: 30_000,
  });

  if (data && !Array.isArray(data) && Array.isArray(data.alerts)) {
    assertLiveDataSource(data.source ?? null, path);
    const mapped = dedupeAlerts(
      data.alerts
        .map((item) => mapRawAlert(item))
        .filter((a): a is ServiceAlert => a != null)
        .filter((a) => isActiveServiceAlert(a.title, a.description))
    ).slice(0, MAX_CLIENT_ALERTS);
    await cacheAlertsSafe(mapped);
    return { alerts: mapped, meta: buildMeta(data, mapped.length) };
  }

  if (Array.isArray(data)) {
    const mapped = dedupeAlerts(
      data
        .map((item) => mapRawAlert(item))
        .filter((a): a is ServiceAlert => a != null)
        .filter((a) => isActiveServiceAlert(a.title, a.description))
    ).slice(0, MAX_CLIENT_ALERTS);
    await cacheAlertsSafe(mapped);
    return { alerts: mapped, meta: buildMeta(null, mapped.length) };
  }

  await cacheAlertsSafe([]);
  return {
    alerts: [],
    meta: { asOf: null, source: "transportnsw", tfnswLive: true, count: 0 },
  };
}

export async function fetchNearbyWithDb(lat: number, lng: number, radius = 2000) {
  const list = await fetchBackendJson<Record<string, unknown>[]>(
    `/api/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
    { timeoutMs: 20_000 }
  );
  if (!list?.length) return [];
  return list.map(mapNearbyStop);
}

export type PlanTripOptions = {
  originId?: string;
  destinationId?: string;
  /** Load earlier trips today (slower — on demand only). */
  includePast?: boolean;
  /** Full service-day timetable (04:00 Sydney → end of day). */
  fullDay?: boolean;
  /** Bypass server cache (pull-to-refresh). */
  forceRefresh?: boolean;
};

function inferStationModeFromId(id: string): Station["mode"] {
  if (id.endsWith("_LR")) return "lightrail";
  if (id.endsWith("_B")) return "bus";
  if (id.endsWith("_F")) return "ferry";
  if (id.startsWith("METRO_") || id.includes("_M")) return "metro";
  return "train";
}

function stationStub(id: string, name: string): Station {
  return {
    id,
    name: name.trim() || id,
    lat: 0,
    lon: 0,
    mode: inferStationModeFromId(id),
  };
}

async function resolveStationForTrip(
  name: string,
  stationId?: string
): Promise<Station | undefined> {
  if (stationId) {
    const id = normalizeStationId(stationId);
    const cached =
      findStationById(id, getStationsSync()) ??
      findStationById(id, SYDNEY_STATIONS);
    if (cached) return cached;
    return stationStub(id, name);
  }
  const local = resolveStationByName(name, getStationsSync());
  if (local) return local;
  await ensureStationsLoaded();
  return resolveStationByName(name, getStationsSync()) ?? undefined;
}

export async function planTripWithDb(
  originName: string,
  destinationName: string,
  departure?: Date | null,
  options?: PlanTripOptions
): Promise<TripItinerary[]> {
  const [orig, dest] = await Promise.all([
    resolveStationForTrip(originName, options?.originId),
    resolveStationForTrip(destinationName, options?.destinationId),
  ]);
  if (!orig || !dest) return [];

  const departParam = departure ? `&departAt=${encodeURIComponent(toIsoString(departure))}` : "";
  const pastParam = options?.includePast ? "&includePast=1" : "";
  const fullDayParam = options?.fullDay ? "&fullDay=1" : "";
  const refreshParam = options?.forceRefresh ? "&refresh=1" : "";
  const journeys = await fetchBackendJson<Record<string, unknown>[]>(
    `/api/trip?originId=${encodeURIComponent(orig.id)}&destinationId=${encodeURIComponent(dest.id)}${departParam}${pastParam}${fullDayParam}${refreshParam}`,
    {
      timeoutMs:
        options?.fullDay
          ? 25_000
          : options?.includePast || orig.mode === "bus" || dest.mode === "bus"
            ? 12_000
            : 5_000,
    }
  );
  if (journeys && journeys.length > 0) {
    for (const jny of journeys) {
      if (String(jny.id || "").startsWith("mock_trip_")) {
        assertLiveDataSource("mock-fallback", "/api/trip");
      }
    }
    return journeys.map((jny) => {
      const dep = parseTfnswTime(jny.departureTime as string);
      const arr = parseTfnswTime(jny.arrivalTime as string);
      const durationFromTimes = Math.max(
        0,
        Math.round((arr.getTime() - dep.getTime()) / 60000)
      );
      return {
        id: jny.id as string,
        duration: durationFromTimes || (jny.totalDurationMinutes as number),
        departureTime: dep,
        arrivalTime: arr,
        transfersCount: jny.transfersCount as number,
        isLive: jny.isLive === true || String(jny.id || "").startsWith("real_trip_"),
        legs: (jny.legs as Array<Record<string, unknown>>).map((leg) => {
          const stopTimesRaw = Array.isArray(leg.stopTimes)
            ? (leg.stopTimes as Array<Record<string, unknown>>)
            : [];
          const depFromStops =
            stopTimesRaw.length >= 2
              ? parseTfnswTime(String(stopTimesRaw[0]?.time ?? ""))
              : parseTfnswTime(leg.departureTime as string);
          const arrFromStops =
            stopTimesRaw.length >= 2
              ? parseTfnswTime(String(stopTimesRaw[stopTimesRaw.length - 1]?.time ?? ""))
              : parseTfnswTime(leg.arrivalTime as string);
          const duration =
            Math.max(
              0,
              Math.round((arrFromStops.getTime() - depFromStops.getTime()) / 60000)
            ) ||
            (leg.durationMinutes as number) ||
            0;
          return {
          mode: (leg.mode === "lightrail" ? "light_rail" : leg.mode) as TripItinerary["legs"][0]["mode"],
          departure: depFromStops,
          arrival: arrFromStops,
          duration,
          stops: (leg.stops as string[]) || [],
          stopTimes: Array.isArray(leg.stopTimes)
            ? (leg.stopTimes as Array<Record<string, unknown>>)
                .map((st) => {
                  const name = String(st.station_name ?? st.name ?? "").trim();
                  const raw = String(st.time ?? "");
                  if (!name || !raw) return null;
                  const lat = Number(st.lat);
                  const lon = Number(st.lon);
                  const row: { station_name: string; time: Date; lat?: number; lon?: number } = {
                    station_name: name,
                    time: parseTfnswTime(raw),
                  };
                  if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    row.lat = lat;
                    row.lon = lon;
                  }
                  return row;
                })
                .filter((st): st is { station_name: string; time: Date; lat?: number; lon?: number } =>
                  st != null
                )
            : undefined,
          originName: leg.originName as string | undefined,
          destinationName: leg.destinationName as string | undefined,
          originStopId: leg.originStopId as string | undefined,
          destinationStopId: leg.destinationStopId as string | undefined,
          platform: leg.platform as string,
          destinationPlatform: leg.destinationPlatform as string | undefined,
          routeNumber: String(leg.routeNumber ?? ""),
        };
        }),
      };
    });
  }
  return [];
}

export type LiveVehiclesFeed = {
  vehicles: VehiclePosition[];
  asOf: string | null;
  source: string | null;
  tfnswLive: boolean;
  count: number;
  message?: string;
};

export type FetchLiveVehiclesOptions = {
  lat: number;
  lng: number;
  mode?: string;
  route?: string;
  radiusM?: number;
  limit?: number;
  refresh?: boolean;
};

export async function fetchLiveVehicles(
  options: FetchLiveVehiclesOptions
): Promise<LiveVehiclesFeed> {
  const params = new URLSearchParams({
    lat: String(options.lat),
    lng: String(options.lng),
    radiusM: String(options.radiusM ?? 12_000),
    limit: String(options.limit ?? 80),
  });
  if (options.mode) params.set("mode", options.mode);
  if (options.route) params.set("route", options.route);
  if (options.refresh) params.set("refresh", "1");

  const data = await fetchBackendJson<{
    vehicles?: unknown[];
    asOf?: string;
    source?: string;
    tfnswLive?: boolean;
    count?: number;
    message?: string;
  }>(`/api/vehicles?${params.toString()}`, { timeoutMs: 30_000 });

  const vehicles: VehiclePosition[] = (data?.vehicles ?? []).map((v) => {
    const row = v as Record<string, unknown>;
    const modeRaw = String(row.mode ?? "train");
    const mode =
      modeRaw === "lightrail" ? "light_rail" : (modeRaw as VehiclePosition["mode"]);
    return {
      id: String(row.id ?? ""),
      routeNumber: String(row.routeNumber ?? row.route_number ?? "—"),
      mode,
      lat: Number(row.lat),
      lon: Number(row.lon),
      bearing: Number(row.bearing) || undefined,
      speed: Number(row.speed) || undefined,
    };
  });

  return {
    vehicles: vehicles.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon)),
    asOf: data?.asOf ?? null,
    source: data?.source ?? null,
    tfnswLive: data?.tfnswLive === true,
    count: data?.count ?? vehicles.length,
    message: data?.message,
  };
}

export async function refreshAllTransitData() {
  const { refreshDeparturesInDb } = await import("../database/repository");
  const { favorites, savedTrips } = (await import("../store/store")).useStore.getState();
  const stationIds = [
    ...favorites.map((f) => f.station_id),
    ...savedTrips.flatMap((t) => [t.origin_id, t.destination_id]),
  ];
  await refreshDeparturesInDb(undefined, stationIds);
}
