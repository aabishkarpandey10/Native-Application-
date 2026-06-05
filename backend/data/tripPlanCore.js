import { getStationById } from "./stationRegistry.js";
import { normalizeStationId } from "./stationAliases.js";
import { formatItdDateTime, resolveTfnswStopId } from "./tfnswHelpers.js";
import { parseTfnswTime } from "./tfnswTime.js";
import { calcTfnswTripCount, mapTfnswJourneys } from "./tfnswTripMapper.js";
import {
  buildTripEndpointParams,
  enrichItinerariesWithDirectTrain,
  finalizeItineraries,
  mergeLiveAndTimetableTrips,
  reclassifyAccessLegs,
} from "./tripPlanner.js";
import { STATION_ID_MAP } from "./sydneyStations.js";
import {
  planLightRailTripsFromTimetable,
  planTripsFromTimetable,
} from "./timetableTripPlanner.js";
import { isTfnswKeyConfigured } from "../src/config/index.js";
import { getTripPlanCache, setTripPlanCache, tripPlanCacheKey } from "./tripPlanCache.js";

const TFNSW_TRIP_TIMEOUT_MS = 9_000;
const MIN_LIVE_TO_SKIP_TIMETABLE = 2;

async function resolveTripStopIds(origin, dest, apiKey, apiBase, originKey, destKey) {
  const mappedOrig = STATION_ID_MAP[originKey] || origin.tfnswStopId;
  const mappedDest = STATION_ID_MAP[destKey] || dest.tfnswStopId;
  const [origId, destId] = await Promise.all([
    resolveTfnswStopId(origin, apiKey, apiBase, mappedOrig).then(
      (id) => id || mappedOrig || originKey
    ),
    resolveTfnswStopId(dest, apiKey, apiBase, mappedDest).then(
      (id) => id || mappedDest || destKey
    ),
  ]);
  return { origId, destId };
}

async function fetchTfnswTrips(origin, dest, departDate, apiKey, apiBase, originKey, destKey, includePast) {
  const { origId, destId } = await resolveTripStopIds(
    origin,
    dest,
    apiKey,
    apiBase,
    originKey,
    destKey
  );
  const { dateStr, timeStr } = formatItdDateTime(departDate);
  const origParams = buildTripEndpointParams(origin, origId);
  const destParams = buildTripEndpointParams(dest, destId);
  const tripCount = calcTfnswTripCount(origin, dest, includePast);
  const url = `${apiBase}/trip?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&depArrMacro=dep&itdDate=${dateStr}&itdTime=${timeStr}&type_origin=${origParams.type}&name_origin=${encodeURIComponent(origParams.name)}&type_destination=${destParams.type}&name_destination=${encodeURIComponent(destParams.name)}&calcNumberOfTrips=${tripCount}`;

  const response = await fetch(url, {
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(TFNSW_TRIP_TIMEOUT_MS),
  });

  if (!response.ok) return null;
  const data = await response.json();
  if (!data.journeys?.length) return null;

  let itineraries = mapTfnswJourneys(data.journeys, origin, dest);
  itineraries = itineraries.map((it) => reclassifyAccessLegs(it, origin, dest));
  return enrichItinerariesWithDirectTrain(itineraries, origin, dest, departDate);
}

/**
 * Plan trips — TfNSW live first, fast PDF timetable only when needed.
 */
export async function planTripsForStations(
  origin,
  dest,
  departDate,
  apiKey,
  apiBase,
  { includePast = false, forceRefresh = false, buildMockItineraries } = {}
) {
  const originKey = origin.id;
  const destKey = dest.id;
  const cacheKey = tripPlanCacheKey(originKey, destKey, departDate, includePast);

  if (!forceRefresh) {
    const cached = getTripPlanCache(cacheKey);
    if (cached) return cached;
  }

  const originMode = origin.mode === "lightrail" ? "light_rail" : origin.mode;
  const destMode = dest.mode === "lightrail" ? "light_rail" : dest.mode;

  if (originMode === "light_rail" && destMode === "light_rail") {
    const lrTrips = planLightRailTripsFromTimetable(origin, dest, departDate, 10, {
      includePast: false,
      fastMode: true,
    });
    if (lrTrips.length > 0) {
      const payload = {
        itineraries: finalizeItineraries(lrTrips, origin, dest),
        meta: { source: "timetable-pdf" },
      };
      setTripPlanCache(cacheKey, payload);
      return payload;
    }
  }

  const bothBus = originMode === "bus" && destMode === "bus";

  const livePromise = isTfnswKeyConfigured()
    ? fetchTfnswTrips(
        origin,
        dest,
        departDate,
        apiKey,
        apiBase,
        originKey,
        destKey,
        includePast
      ).catch((apiErr) => {
        console.warn("[TripPlanner] TfNSW failed:", apiErr.message);
        return [];
      })
    : Promise.resolve([]);

  // Defer CPU-heavy PDF planning so the TfNSW request can start first.
  const timetablePromise = !bothBus
    ? new Promise((resolve) => {
        setImmediate(() => {
          resolve(
            planTripsFromTimetable(origin, dest, departDate, includePast ? 14 : 10, {
              includePast,
              fastMode: true,
            })
          );
        });
      })
    : null;

  let liveItineraries = (await livePromise) || [];

  const skipTimetable =
    bothBus ||
    (!includePast && liveItineraries.length >= MIN_LIVE_TO_SKIP_TIMETABLE);

  let merged = liveItineraries;
  if (!skipTimetable) {
    const timetableSupplement = timetablePromise
      ? await timetablePromise
      : planTripsFromTimetable(origin, dest, departDate, includePast ? 14 : 10, {
          includePast,
          fastMode: true,
        });
    merged = mergeLiveAndTimetableTrips(liveItineraries, timetableSupplement, {
      includePast,
    });
  } else if (liveItineraries.length > 0) {
    merged = mergeLiveAndTimetableTrips(liveItineraries, [], { includePast: false });
  } else if (timetablePromise) {
    merged = await timetablePromise;
  }

  if (merged.length > 0) {
    const payload = {
      itineraries: finalizeItineraries(merged, origin, dest),
      meta: {
        source: liveItineraries.length ? "tfnsw-live" : "timetable-pdf",
      },
    };
    setTripPlanCache(cacheKey, payload);
    return payload;
  }

  const timetableTrips = planTripsFromTimetable(origin, dest, departDate, includePast ? 16 : 10, {
    includePast,
    fastMode: true,
  });
  if (timetableTrips.length > 0) {
    const payload = {
      itineraries: finalizeItineraries(
        enrichItinerariesWithDirectTrain(timetableTrips, origin, dest, departDate),
        origin,
        dest
      ),
      meta: { source: "timetable-pdf" },
    };
    setTripPlanCache(cacheKey, payload);
    return payload;
  }

  if (buildMockItineraries) {
    const mock = buildMockItineraries(origin, dest, departDate);
    const payload = {
      itineraries: finalizeItineraries(
        enrichItinerariesWithDirectTrain(mock, origin, dest, departDate),
        origin,
        dest
      ),
      meta: { source: "mock-fallback" },
    };
    setTripPlanCache(cacheKey, payload);
    return payload;
  }

  const empty = { itineraries: [], meta: { source: "none" } };
  setTripPlanCache(cacheKey, empty);
  return empty;
}

export function parseTripPlannerQuery(req) {
  const originId = normalizeStationId(String(req.query.originId || req.query.from || ""));
  const destinationId = normalizeStationId(String(req.query.destinationId || req.query.to || ""));
  const departAt = req.query.departAt;
  const includePast = req.query.includePast === "1" || req.query.includePast === "true";
  const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";

  if (!originId || !destinationId) {
    return { error: { status: 400, message: "originId and destinationId required" } };
  }

  const origin = getStationById(originId);
  const dest = getStationById(destinationId);
  if (!origin || !dest) {
    return { error: { status: 404, message: "Unknown origin or destination" } };
  }

  const departDate = departAt ? parseTfnswTime(String(departAt)) : new Date();
  return { origin, dest, departDate, includePast, forceRefresh };
}
