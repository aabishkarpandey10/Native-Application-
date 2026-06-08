import { config, isTfnswKeyConfigured } from "../src/config/index.js";
import { getStationById } from "./stationRegistry.js";
import {
  buildFullDayDeparturesPayload,
  buildPdfDeparturesPayload,
  hasCustomTimetable,
  mergeLiveOntoSchedule,
} from "./customTimetables.js";
import { buildMockDepartures } from "./mockDepartures.js";
import { normalizeStationId } from "./stationAliases.js";
import { filterActiveDepartures } from "./activeDepartures.js";
import { buildMockStopsForDeparture } from "./stopSequence.js";
import { buildDepartureStopSequence } from "./timedStopSequence.js";
import { STATION_ID_MAP } from "./sydneyStations.js";
import {
  fetchDepartureBoardEvents,
  fetchFullDayDepartureBoardEvents,
  parseStopEvent,
  resolveTfnswStopId,
} from "./tfnswHelpers.js";
import {
  getInFlightTfnsw,
  markTfnswFetched,
  setInFlightTfnsw,
  shouldThrottleTfnsw,
} from "./tfnswRequestGate.js";
import { isSydneyWeekend, parseTfnswTime } from "./tfnswTime.js";

const TFNSW_API_BASE = config.tfnsw.baseUrl;
const MIN_LIVE_DEPARTURES = 1;
const MIN_FULLDAY_LIVE = 3;

function sortByDepartureTime(list) {
  return [...list].sort(
    (a, b) =>
      parseTfnswTime(a.realTime ?? a.scheduledTime).getTime() -
      parseTfnswTime(b.realTime ?? b.scheduledTime).getTime()
  );
}

function dedupeDepartures(list) {
  const seen = new Set();
  const out = [];
  for (const d of list) {
    const t = parseTfnswTime(d.realTime ?? d.scheduledTime).getTime();
    const key = `${d.routeNumber}|${d.destination}|${Math.floor(t / 60_000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}

function enrichDepartureStops(station, stationId, departure) {
  const minStops = station?.mode === "bus" ? 4 : 2;
  if (departure.stops?.length >= minStops) return departure;
  const sched = parseTfnswTime(departure.scheduledTime);
  const row = {
    destination: departure.destination,
    routeNumber: departure.routeNumber,
  };
  const timed = buildDepartureStopSequence(station, stationId, row, sched);
  if (timed?.length >= 2) {
    return { ...departure, stops: timed };
  }
  return {
    ...departure,
    stops: buildMockStopsForDeparture(
      station,
      stationId,
      departure.destination,
      departure.routeNumber,
      departure.mode,
      sched,
      departure.realTime,
      row
    ),
  };
}

function mapLiveBoard(station, stationId, events, { lite = false } = {}) {
  const now = new Date();
  let mappedDepartures = events
    .map((event) => parseStopEvent(event, stationId))
    .map((d) => (lite ? d : enrichDepartureStops(station, stationId, d)));

  mappedDepartures = filterActiveDepartures(
    dedupeDepartures(sortByDepartureTime(mappedDepartures)),
    now,
    { stationId }
  ).slice(0, 40);

  if (mappedDepartures.length === 0) return null;

  return {
    source: "tfnsw-live",
    departures: mappedDepartures,
    meta: {
      refreshedAt: now.toISOString(),
      scheduleSource: "transportnsw.info",
      weekend: isSydneyWeekend(now),
    },
  };
}

/** Same logic as GET /api/departures — shared with AI live context. */
export async function fetchStationDepartures(
  stationId,
  apiKey,
  { fullDay = false, forceRefresh = false, routeFilter = null } = {}
) {
  if (!stationId) {
    return { source: "error", departures: [], error: "Missing stationId" };
  }

  stationId = normalizeStationId(stationId);

  const inflightKey = `${stationId}:${fullDay ? "day" : "board"}`;
  const existing = getInFlightTfnsw(inflightKey);
  if (existing) return existing;

  const run = fetchStationDeparturesInner(stationId, apiKey, {
    fullDay,
    forceRefresh,
    routeFilter,
  });
  return setInFlightTfnsw(inflightKey, run);
}

function applyRouteFilter(payload, routeFilter) {
  if (!routeFilter || !payload?.departures?.length) return payload;
  const want = String(routeFilter).trim().toUpperCase();
  const filtered = payload.departures.filter(
    (d) => String(d.routeNumber || "").toUpperCase() === want
  );
  return {
    ...payload,
    departures: filtered,
    meta: {
      ...(payload.meta || {}),
      routeFilter: want,
    },
  };
}

async function fetchTfnswFullDayTimetable(stationId, station, apiKey) {
  let tfnswId = STATION_ID_MAP[stationId] || station?.tfnswStopId;

  if (!tfnswId && station) {
    tfnswId = await resolveTfnswStopId(station, apiKey, TFNSW_API_BASE, tfnswId);
  }

  markTfnswFetched(stationId);
  const now = new Date();

  try {
    const { events, boardRef } = await fetchFullDayDepartureBoardEvents(
      station,
      apiKey,
      TFNSW_API_BASE,
      tfnswId
    );
    if (!events.length) return null;

    let mapped = events
      .map((event) => parseStopEvent(event, stationId))
      .map((d) => enrichDepartureStops(station, stationId, d));
    mapped = dedupeDepartures(sortByDepartureTime(mapped));
    mapped = filterActiveDepartures(mapped, now, { stationId, fullDay: true });

    if (mapped.length === 0) return null;

    return {
      source: "tfnsw-live-fullday",
      departures: mapped,
      meta: {
        refreshedAt: now.toISOString(),
        scheduleSource: "transportnsw.info",
        fullDay: true,
        stopId: boardRef,
        weekend: isSydneyWeekend(now),
      },
    };
  } catch (apiErr) {
    console.warn(`TfNSW full-day timetable failed for ${stationId}:`, apiErr.message);
    return null;
  }
}

async function fetchLiveDepartures(stationId, station, apiKey, { lite = false } = {}) {
  let tfnswId = STATION_ID_MAP[stationId] || station?.tfnswStopId;

  if (!tfnswId && station) {
    tfnswId = await resolveTfnswStopId(station, apiKey, TFNSW_API_BASE, tfnswId);
  }

  markTfnswFetched(stationId);
  const now = new Date();

  try {
    const { events, boardRef } = await fetchDepartureBoardEvents(
      station,
      apiKey,
      TFNSW_API_BASE,
      tfnswId,
      now
    );
    if (!events.length) return null;

    const payload = mapLiveBoard(station, stationId, events, { lite });
    if (!payload) return null;
    payload.meta.stopId = boardRef;
    return payload;
  } catch (apiErr) {
    console.warn(`TfNSW departures failed for ${stationId}:`, apiErr.message);
    return null;
  }
}

async function fetchStationDeparturesInner(
  stationId,
  apiKey,
  { fullDay = false, forceRefresh = false, routeFilter = null } = {}
) {
  const station = getStationById(stationId);
  const pdfAvailable = hasCustomTimetable(stationId);
  const now = new Date();

  const skipThrottle = forceRefresh || fullDay;
  const canFetchLive =
    isTfnswKeyConfigured() && (skipThrottle || !shouldThrottleTfnsw(stationId));

  const isBus = station?.mode === "bus";
  const finish = (payload) => applyRouteFilter(payload, routeFilter);

  let liveResult = null;
  if (canFetchLive) {
    try {
      liveResult = fullDay
        ? await fetchTfnswFullDayTimetable(stationId, station, apiKey)
        : await fetchLiveDepartures(stationId, station, apiKey, { lite: isBus });
    } catch (apiErr) {
      console.warn(`TfNSW departures failed for ${stationId}:`, apiErr.message);
    }
  }

  const liveCount = liveResult?.departures?.length ?? 0;

  if (liveCount > 0) {
    liveResult.departures = filterActiveDepartures(liveResult.departures, now, {
      stationId,
      fullDay,
    });
    if (liveResult.departures.length > 0) {
      return finish({
        ...liveResult,
        source: fullDay ? "tfnsw-live-fullday" : "tfnsw-live",
        meta: {
          ...(liveResult.meta || {}),
          scheduleSource: "transportnsw.info",
          fullDay: fullDay || undefined,
          syncedAt: now.toISOString(),
        },
      });
    }
  }

  if (pdfAvailable) {
    const pdf = fullDay
      ? buildFullDayDeparturesPayload(station, stationId, 3000)
      : buildPdfDeparturesPayload(station, stationId, 80);

    if (pdf?.departures?.length) {
      let departures = pdf.departures;
      if (liveResult?.departures?.length) {
        departures = mergeLiveOntoSchedule(departures, liveResult.departures);
      }
      departures = filterActiveDepartures(departures, now, { stationId, fullDay });
      if (departures.length > 0) {
        const source = liveResult?.departures?.length
          ? fullDay
            ? "tfnsw-live+timetable-fullday"
            : isBus
              ? "tfnsw-live+timetable-gtfs"
              : "tfnsw-live+timetable-pdf"
          : pdf.source;
        return finish({
          source,
          departures,
          meta: {
            ...pdf.meta,
            ...(liveResult?.meta || {}),
            scheduleSource: liveResult?.departures?.length
              ? "transportnsw.info"
              : pdf.meta?.scheduleSource,
            fullDay: fullDay || undefined,
            syncedAt: now.toISOString(),
            weekendNote:
              isBus && !liveResult?.departures?.length && isSydneyWeekend(now)
                ? "Weekday GTFS times — live board unavailable"
                : pdf.meta?.weekendNote,
          },
        });
      }
    }
  }

  if (liveCount >= (fullDay ? MIN_FULLDAY_LIVE : MIN_LIVE_DEPARTURES)) {
    return finish(liveResult);
  }

  if (liveCount > 0) {
    return finish(liveResult);
  }

  if (pdfAvailable) {
    const pdf = fullDay
      ? buildFullDayDeparturesPayload(station, stationId, 3000)
      : buildPdfDeparturesPayload(station, stationId, 80);
    if (pdf?.departures?.length) {
      pdf.departures = filterActiveDepartures(pdf.departures, now, { stationId, fullDay });
      if (pdf.departures.length > 0) {
        if (isBus) {
          pdf.meta = {
            ...pdf.meta,
            scheduleSource: "transportnsw-gtfs-weekday",
            weekendNote: isSydneyWeekend(now)
              ? "Weekday GTFS times — live board unavailable"
              : null,
          };
        }
        return finish(pdf);
      }
    }
  }

  if (config.allowMockData) {
    const departures = buildMockDepartures(station, stationId, 8);
    return finish({
      source: "mock",
      departures: filterActiveDepartures(departures, now, { stationId }),
      meta: {
        refreshedAt: now.toISOString(),
        scheduleSource: isTfnswKeyConfigured() ? "transportnsw-unavailable" : "mock",
      },
    });
  }

  return finish({
    source: "unavailable",
    departures: [],
    meta: {
      refreshedAt: now.toISOString(),
      scheduleSource: "unavailable",
    },
  });
}
