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
  formatItdDateTime,
  matchesStationMode,
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
const MIN_LIVE_DEPARTURES = 3;

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
  if (departure.stops?.length >= 2) return departure;
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

/** Same logic as GET /api/departures — shared with AI live context. */
export async function fetchStationDepartures(
  stationId,
  apiKey,
  { fullDay = false, forceRefresh = false } = {}
) {
  if (!stationId) {
    return { source: "error", departures: [], error: "Missing stationId" };
  }

  stationId = normalizeStationId(stationId);

  const inflightKey = `${stationId}:${fullDay ? "day" : "board"}`;
  const existing = getInFlightTfnsw(inflightKey);
  if (existing) return existing;

  const run = fetchStationDeparturesInner(stationId, apiKey, { fullDay, forceRefresh });
  return setInFlightTfnsw(inflightKey, run);
}

async function fetchLiveDepartures(stationId, station, apiKey, { lite = false } = {}) {
  let tfnswId = STATION_ID_MAP[stationId] || station?.tfnswStopId;

  if (!tfnswId && station) {
    tfnswId = await resolveTfnswStopId(station, apiKey, TFNSW_API_BASE, tfnswId);
  }
  if (!tfnswId) return null;

  markTfnswFetched(stationId);
  const now = new Date();
  const { dateStr, timeStr } = formatItdDateTime(now);
  const url = `${TFNSW_API_BASE}/departure_mon?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&mode=direct&type_dm=stop&name_dm=${tfnswId}&itdDate=${dateStr}&itdTime=${timeStr}&TfNSWDM=true`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Apikey ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    if (response.status !== 429) {
      console.warn(
        `TfNSW departures HTTP ${response.status} for ${stationId} (stop ${tfnswId})`
      );
    }
    return null;
  }

  const data = await response.json();
  if (!data.stopEvents?.length) return null;

  const stationMode = station?.mode || "train";
  const events = data.stopEvents.filter((ev) => matchesStationMode(ev, stationMode));

  let mappedDepartures = events
    .map((event) => parseStopEvent(event, stationId))
    .map((d) => (lite ? d : enrichDepartureStops(station, stationId, d)));

  mappedDepartures = filterActiveDepartures(
    dedupeDepartures(sortByDepartureTime(mappedDepartures)),
    now,
    { stationId }
  ).slice(0, 40);

  if (mappedDepartures.length === 0) return null;

  const departures = mappedDepartures;

  return {
    source: "tfnsw-live",
    departures,
    meta: {
      refreshedAt: new Date().toISOString(),
      stopId: tfnswId,
      weekend: isSydneyWeekend(now),
    },
  };
}

async function fetchStationDeparturesInner(stationId, apiKey, { fullDay = false, forceRefresh = false } = {}) {
  const station = getStationById(stationId);
  const pdfAvailable = hasCustomTimetable(stationId);
  const now = new Date();

  let liveResult = null;
  const skipThrottle = forceRefresh || fullDay;
  const canFetchLive =
    isTfnswKeyConfigured() && (skipThrottle || !shouldThrottleTfnsw(stationId));

  const isLightRail =
    station?.mode === "lightrail" || station?.mode === "light_rail";
  const isMetro = station?.mode === "metro";

  if (pdfAvailable && fullDay) {
    const pdfPromise = new Promise((resolve) => {
      setImmediate(() => resolve(buildFullDayDeparturesPayload(station, stationId, 3000)));
    });
    const livePromise = canFetchLive
      ? fetchLiveDepartures(stationId, station, apiKey, { lite: true }).catch((apiErr) => {
          console.warn(`TfNSW departures failed for ${stationId}:`, apiErr.message);
          return null;
        })
      : Promise.resolve(null);

    const [pdf, live] = await Promise.all([pdfPromise, livePromise]);
    liveResult = live;

    if (pdf?.departures?.length) {
      let departures = pdf.departures;
      if (liveResult?.departures?.length) {
        departures = mergeLiveOntoSchedule(departures, liveResult.departures);
      }
      departures = filterActiveDepartures(departures, now, { stationId, fullDay: true });
      if (departures.length > 0) {
        return {
          source: liveResult?.departures?.length
            ? "tfnsw-live+timetable-pdf-fullday"
            : pdf.source,
          departures,
          meta: {
            ...pdf.meta,
            ...(liveResult?.meta || {}),
            fullDay: true,
            syncedAt: now.toISOString(),
          },
        };
      }
    }
  } else if (canFetchLive) {
    try {
      liveResult = await fetchLiveDepartures(stationId, station, apiKey);
    } catch (apiErr) {
      console.warn(`TfNSW departures failed for ${stationId}:`, apiErr.message);
    }
  }

  if (pdfAvailable && (isLightRail || isMetro)) {
    const pdf = buildPdfDeparturesPayload(station, stationId, 80);
    if (pdf?.departures?.length) {
      pdf.departures = filterActiveDepartures(pdf.departures, now, { stationId });
      if (pdf.departures.length > 0) {
        if (liveResult?.departures?.length) {
          const merged = filterActiveDepartures(
            mergeLiveOntoSchedule(pdf.departures, liveResult.departures),
            now,
            { stationId }
          );
          return {
            source: "tfnsw-live+timetable-pdf",
            departures: merged,
            meta: { ...liveResult.meta, ...pdf.meta },
          };
        }
        return pdf;
      }
    }
  }

  if (liveResult?.departures?.length >= MIN_LIVE_DEPARTURES && !fullDay) {
    return liveResult;
  }

  if (pdfAvailable) {
    const pdf = fullDay
      ? buildFullDayDeparturesPayload(station, stationId, 3000)
      : buildPdfDeparturesPayload(station, stationId, 80);
    if (pdf?.departures?.length) {
      pdf.departures = filterActiveDepartures(pdf.departures, now, {
        stationId,
        fullDay,
      });
      if (pdf.departures.length > 0) {
        return pdf;
      }
    }
  }

  if (liveResult?.departures?.length > 0) {
    return liveResult;
  }

  const departures = buildMockDepartures(station, stationId, 8);
  return {
    source: "mock",
    departures: filterActiveDepartures(departures, now, { stationId }),
    meta: { refreshedAt: now.toISOString() },
  };
}
