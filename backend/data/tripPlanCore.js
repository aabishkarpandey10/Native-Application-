import { getStationById } from "./stationRegistry.js";
import { normalizeStationId } from "./stationAliases.js";
import { config } from "../src/config/index.js";
import { formatItdDateTime, resolveTfnswStopId } from "./tfnswHelpers.js";
import { parseTfnswTime, sydneyServiceDayStart } from "./tfnswTime.js";
import { calcTfnswTripCount, mapTfnswJourneys } from "./tfnswTripMapper.js";
import {
  buildTripEndpointParams,
  enrichItinerariesWithDirectTrain,
  finalizeItineraries,
  finalizeTimetableItineraries,
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

const TFNSW_TRIP_TIMEOUT_MS = Number(process.env.TFNSW_TRIP_TIMEOUT_MS) || 8_000;
const TFNSW_FULLDAY_TRIP_TIMEOUT_MS = Number(process.env.TFNSW_FULLDAY_TRIP_TIMEOUT_MS) || 20_000;
const REST_OF_DAY_TRIP_CAP = 500;
/** Upcoming-only trips — keep small for sub-2s responses. */
const FAST_TRIP_CAP = 12;

const tripPlanInFlight = new Map();

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

async function requestTfnswJourneys(
  apiBase,
  apiKey,
  departDate,
  origParams,
  destParams,
  tripCount,
  timeoutMs
) {
  const { dateStr, timeStr } = formatItdDateTime(departDate);
  const url = `${apiBase}/trip?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&depArrMacro=dep&itdDate=${dateStr}&itdTime=${timeStr}&type_origin=${origParams.type}&name_origin=${encodeURIComponent(origParams.name)}&type_destination=${destParams.type}&name_destination=${encodeURIComponent(destParams.name)}&calcNumberOfTrips=${tripCount}`;
  const response = await fetch(url, {
    headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.journeys?.length ? data.journeys : null;
}

function coordParams(station) {
  const lat = station.lat ?? station.latitude;
  const lon = station.lon ?? station.longitude;
  if (lat == null || lon == null) return null;
  return { type: "coord", name: `${lon}:${lat}:EPSG:4326` };
}

async function fetchTfnswTrips(
  origin,
  dest,
  departDate,
  apiKey,
  apiBase,
  originKey,
  destKey,
  { includePast = false, fullDay = false } = {}
) {
  const { origId, destId } = await resolveTripStopIds(
    origin,
    dest,
    apiKey,
    apiBase,
    originKey,
    destKey
  );
  const origParams = buildTripEndpointParams(origin, origId);
  const destParams = buildTripEndpointParams(dest, destId);
  const tripCount = calcTfnswTripCount(origin, dest, includePast, fullDay);
  const isBusTrip = origin.mode === "bus" || dest.mode === "bus";
  const timeoutMs = fullDay
    ? TFNSW_FULLDAY_TRIP_TIMEOUT_MS
    : isBusTrip
      ? 12_000
      : includePast
        ? 12_000
        : TFNSW_TRIP_TIMEOUT_MS;

  let journeys =
    (await requestTfnswJourneys(
      apiBase,
      apiKey,
      departDate,
      origParams,
      destParams,
      tripCount,
      timeoutMs
    )) || null;

  if (!journeys && isBusTrip) {
    const coordOrig = coordParams(origin);
    const coordDest = coordParams(dest);
    if (coordOrig && coordDest) {
      journeys = await requestTfnswJourneys(
        apiBase,
        apiKey,
        departDate,
        coordOrig,
        coordDest,
        tripCount,
        timeoutMs
      );
    }
  }

  if (!journeys?.length) return null;

  let itineraries = mapTfnswJourneys(journeys, origin, dest);
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
  { includePast = false, fullDay = false, forceRefresh = false, buildMockItineraries } = {}
) {
  const originKey = origin.id;
  const destKey = dest.id;
  const effectivePast = fullDay || includePast;
  const planDate = fullDay ? sydneyServiceDayStart(departDate) : departDate;
  const cacheKey = tripPlanCacheKey(originKey, destKey, planDate, effectivePast, fullDay);

  if (!forceRefresh) {
    const cached = getTripPlanCache(cacheKey);
    if (cached) return cached;
  }

  if (!forceRefresh && tripPlanInFlight.has(cacheKey)) {
    return tripPlanInFlight.get(cacheKey);
  }

  const run = (async () => {
  if (fullDay) {
    const liveItineraries = isTfnswKeyConfigured()
      ? (await fetchTfnswTrips(origin, dest, planDate, apiKey, apiBase, originKey, destKey, {
          includePast: true,
          fullDay: true,
        }).catch((apiErr) => {
          console.warn("[TripPlanner] TfNSW full-day failed:", apiErr.message);
          return [];
        })) || []
      : [];

    const timetableSupplement = planTripsFromTimetable(
      origin,
      dest,
      planDate,
      REST_OF_DAY_TRIP_CAP,
      { includePast: true, fullDay: true, fastMode: true }
    );

    const merged = mergeLiveAndTimetableTrips(liveItineraries, timetableSupplement, {
      includePast: true,
    });

    const payload = {
      itineraries: liveItineraries.length
        ? finalizeItineraries(merged, origin, dest)
        : finalizeTimetableItineraries(timetableSupplement),
      meta: {
        source: liveItineraries.length
          ? timetableSupplement.length
            ? "tfnsw-live+timetable-fullday"
            : "tfnsw-live"
          : timetableSupplement.length
            ? "timetable-fullday"
            : "none",
        scheduleSource: "transportnsw.info",
        fullDay: true,
      },
    };
    setTripPlanCache(cacheKey, payload, { ttlMs: 120_000 });
    return payload;
  }

  const originMode = origin.mode === "lightrail" ? "light_rail" : origin.mode;
  const destMode = dest.mode === "lightrail" ? "light_rail" : dest.mode;

  if (originMode === "light_rail" && destMode === "light_rail") {
    const [liveRaw, lrPdf] = await Promise.all([
      isTfnswKeyConfigured()
        ? fetchTfnswTrips(origin, dest, departDate, apiKey, apiBase, originKey, destKey, {
            includePast,
          }).catch(() => [])
        : Promise.resolve([]),
      Promise.resolve(
        planLightRailTripsFromTimetable(origin, dest, planDate, 10, {
          includePast: false,
          fastMode: true,
        })
      ),
    ]);
    const liveItineraries = liveRaw || [];
    const merged = mergeLiveAndTimetableTrips(liveItineraries, lrPdf, { includePast });
    if (merged.length > 0) {
      const payload = {
        itineraries: finalizeItineraries(merged, origin, dest),
        meta: {
          source: liveItineraries.length ? "tfnsw-live" : "timetable-pdf",
          scheduleSource: liveItineraries.length ? "transportnsw.info" : "timetable-pdf",
        },
      };
      setTripPlanCache(cacheKey, payload);
      return payload;
    }
  }

  const bothBus = originMode === "bus" || destMode === "bus";

  // Bus: real-time trips from transportnsw.info only (GTFS timetable is for departures fallback).
  const skipTimetableSupplement = bothBus;
  const timetableCap = includePast ? 80 : bothBus ? 24 : FAST_TRIP_CAP;

  const [liveRaw, timetableSupplement] = await Promise.all([
    isTfnswKeyConfigured()
      ? fetchTfnswTrips(origin, dest, departDate, apiKey, apiBase, originKey, destKey, {
          includePast,
        }).catch((apiErr) => {
          console.warn("[TripPlanner] TfNSW failed:", apiErr.message);
          return [];
        })
      : Promise.resolve([]),
    skipTimetableSupplement
      ? Promise.resolve([])
      : Promise.resolve(
          planTripsFromTimetable(origin, dest, departDate, timetableCap, {
            includePast,
            fastMode: !bothBus,
          })
        ),
  ]);
  const liveItineraries = liveRaw || [];

  let merged = skipTimetableSupplement
    ? liveItineraries
    : mergeLiveAndTimetableTrips(liveItineraries, timetableSupplement, {
        includePast,
      });

  if (merged.length > 0) {
    const finalized = liveItineraries.length
      ? finalizeItineraries(merged, origin, dest)
      : finalizeTimetableItineraries(merged);
    const payload = {
      itineraries: finalized,
      meta: {
        source: liveItineraries.length
          ? timetableSupplement.length
            ? "tfnsw-live+timetable-pdf"
            : "tfnsw-live"
          : "timetable-pdf",
        scheduleSource: liveItineraries.length ? "transportnsw.info" : "timetable-pdf",
      },
    };
    setTripPlanCache(cacheKey, payload, { ttlMs: 120_000 });
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

  if (buildMockItineraries && config.allowMockData) {
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
  })();

  if (!forceRefresh) tripPlanInFlight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    tripPlanInFlight.delete(cacheKey);
  }
}

export function parseTripPlannerQuery(req) {
  const originId = normalizeStationId(String(req.query.originId || req.query.from || ""));
  const destinationId = normalizeStationId(String(req.query.destinationId || req.query.to || ""));
  const departAt = req.query.departAt;
  const includePast = req.query.includePast === "1" || req.query.includePast === "true";
  const fullDay = req.query.fullDay === "1" || req.query.fullDay === "true";
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
  return { origin, dest, departDate, includePast, fullDay, forceRefresh };
}
