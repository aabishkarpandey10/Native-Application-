import { getStations } from "./adminStore.js";
import { getServiceAlerts } from "./alertsService.js";
import { rankNearbyStations } from "./nearby.js";
import { fetchStationDepartures } from "./departuresService.js";
import { minutesUntil, formatSydneyTime } from "./tfnswTime.js";

export const MODE_SECTIONS = [
  { key: "train", label: "Trains", modes: ["train"] },
  { key: "metro", label: "Metro", modes: ["metro"] },
  { key: "lightrail", label: "Light rail", modes: ["lightrail", "light_rail"] },
  { key: "ferry", label: "Ferries", modes: ["ferry"] },
  { key: "bus", label: "Buses", modes: ["bus"] },
];

function normalizeMode(mode) {
  return String(mode || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function stationMatchesBucket(stationMode, bucketModes) {
  const m = normalizeMode(stationMode);
  return bucketModes.some((b) => {
    const n = normalizeMode(b);
    return m === n || m.replace(/_/g, "") === n.replace(/_/g, "");
  });
}

function summarizeDeparture(dep) {
  const mins = minutesUntil(dep.realTime ?? dep.scheduledTime);
  return {
    route: dep.routeNumber,
    destination: dep.destination,
    platform: dep.platform,
    minutes: mins,
    label: mins <= 0 ? "now" : `${mins} min`,
    delayMinutes: Number(dep.delayMinutes ?? 0),
    scheduled: formatSydneyTime(dep.scheduledTime ?? dep.realTime),
  };
}

async function boardsForStations(stationRows, apiKey, maxPerStop = 3) {
  return Promise.all(
    stationRows.map(async (stop) => {
      const { source, departures } = await fetchStationDepartures(stop.station_id, apiKey);
      return {
        station_id: stop.station_id,
        station_name: stop.station_name,
        mode: stop.transit_mode,
        distance_meters: stop.distance_meters,
        source,
        next_departures: departures.slice(0, maxPerStop).map(summarizeDeparture),
      };
    })
  );
}

/**
 * Live departures grouped by mode for assistant UI + AI context.
 */
export async function buildLiveBoardByMode({
  lat,
  lng,
  apiKey,
  favorites = [],
  radiusMeters = 6000,
  stopsPerMode = 2,
}) {
  const stations = getStations().filter((s) => !s.disabled);
  const alertPayload = await getServiceAlerts(apiKey);
  const alerts = alertPayload.alerts ?? [];
  const now = new Date();

  const byMode = {};

  for (const section of MODE_SECTIONS) {
    const modeStations = stations.filter((s) => stationMatchesBucket(s.mode, section.modes));
    const nearby = rankNearbyStations(modeStations, lat, lng, radiusMeters, stopsPerMode);
    byMode[section.key] = {
      label: section.label,
      stops: await boardsForStations(nearby, apiKey),
    };
  }

  const favoritesBoards = await Promise.all(
    favorites.slice(0, 6).map(async (fav) => {
      const { source, departures } = await fetchStationDepartures(fav.station_id, apiKey);
      return {
        station_id: fav.station_id,
        station_name: fav.station_name,
        mode: fav.transit_mode,
        source,
        next_departures: departures.slice(0, 3).map(summarizeDeparture),
      };
    })
  );

  const usesLiveTfnsw =
    alertPayload.tfnswLive ||
    Object.values(byMode).some((s) => s.stops.some((b) => b.source === "tfnsw")) ||
    favoritesBoards.some((f) => f.source === "tfnsw");

  const alertsByMode = {};
  for (const section of MODE_SECTIONS) {
    alertsByMode[section.key] = alerts.filter((a) =>
      stationMatchesBucket(a.mode, section.modes)
    );
  }

  return {
    asOf: alertPayload.asOf || now.toISOString(),
    tfnswLive: usesLiveTfnsw,
    dataSource: usesLiveTfnsw
      ? alertPayload.tfnswLive
        ? "TfNSW live departures & alerts"
        : "TfNSW live departures"
      : "Scheduled / mock timetables",
    alertsSource: alertPayload.source,
    byMode,
    favorites: favoritesBoards,
    alertsByMode,
    nearby: Object.values(byMode).flatMap((s) => s.stops),
  };
}
