import { getBusLinesForStation } from "./busNetworkData.js";
import { buildMockStopsForDeparture } from "./stopSequence.js";
import { SYDNEY_TRANSIT_LINES } from "./sydneyNetworks.js";
import {
  getLightRailLinesForStation,
  LIGHT_RAIL_LINE_STATION_IDS,
} from "./lightRailNetworkData.js";
import {
  getMetroLinesForStation,
  METRO_LINE_STATION_IDS,
} from "./metroNetworkData.js";
import {
  getStationTimetableData,
  hasStationTimetable,
  warmLightRailTimetables,
  warmMetroTimetables,
  warmBusTimetableIndex,
  rebuildTimetableIndex,
} from "./timetableLoader.js";
import {
  isSydneyWeekend,
  occurrenceOnServiceDay,
  parseTfnswTime,
  sydneyServiceDayStart,
  sydneyWallClockToUtc,
  toIsoString,
} from "./tfnswTime.js";
import { buildDepartureStopSequence, estimateServiceEndMs } from "./timedStopSequence.js";

export { warmLightRailTimetables, warmMetroTimetables, warmBusTimetableIndex };

function isBusRoute(routeNumber, station) {
  const route = String(routeNumber || "");
  return (
    station?.mode === "bus" ||
    /^\d{1,4}[A-Z]?$/i.test(route) ||
    /^B\d/i.test(route)
  );
}

export function reloadCustomTimetables() {
  stationRowIndexCache.clear();
  rebuildTimetableIndex();
}

/** Convert HH:MM Sydney wall clock to the next upcoming Date (today or tomorrow). */
export function nextOccurrence(hhmm, now = new Date()) {
  const [h, m] = hhmm.split(":").map(Number);
  const parts = sydneyDateParts(now);
  let when = sydneyWallClockToUtc(parts.year, parts.month, parts.day, h, m);
  if (when.getTime() < now.getTime() - 90_000) {
    const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
    const tp = sydneyDateParts(tomorrow);
    when = sydneyWallClockToUtc(tp.year, tp.month, tp.day, h, m);
  }
  return when;
}

function sydneyDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function hasCustomTimetable(stationId) {
  return hasStationTimetable(stationId);
}

/** Minutes from 04:00 Sydney service-day start (0–1439). Handles GTFS 25:xx times. */
function serviceMinuteFromHhmm(hhmm) {
  const [hRaw, mRaw] = String(hhmm || "00:00").split(":").map(Number);
  let totalMin = (Number.isFinite(hRaw) ? hRaw : 0) * 60 + (Number.isFinite(mRaw) ? mRaw : 0);
  while (totalMin >= 24 * 60) totalMin -= 24 * 60;
  let sm = totalMin - 4 * 60;
  if (sm < 0) sm += 24 * 60;
  return sm;
}

function currentServiceMinute(now = new Date()) {
  const dayStart = sydneyServiceDayStart(now);
  return Math.max(0, Math.floor((now.getTime() - dayStart.getTime()) / 60_000));
}

const stationRowIndexCache = new Map();

function rowsForStation(stationId) {
  const data = getStationTimetableData(stationId);
  let rows = data.stations[stationId]?.departures;
  if (!rows?.length) rows = fillLightRailRowsFromBranch(stationId, data);
  if (!rows?.length) rows = fillMetroRowsFromBranch(stationId, data);
  return rows || [];
}

function whenFromServiceMinute(serviceMinute, now = new Date()) {
  const dayStart = sydneyServiceDayStart(now);
  return new Date(dayStart.getTime() + serviceMinute * 60_000);
}

function getIndexedStationRows(stationId) {
  const cached = stationRowIndexCache.get(stationId);
  if (cached) return cached.indexed;

  const rows = rowsForStation(stationId);
  if (!rows.length) return [];

  const indexed = rows
    .map((row, index) => ({
      row,
      index,
      serviceMinute: serviceMinuteFromHhmm(row.scheduledTime),
    }))
    .sort((a, b) => a.serviceMinute - b.serviceMinute);

  stationRowIndexCache.set(stationId, { indexed });
  return indexed;
}

function firstIndexAtOrAfterServiceMinute(indexed, cutoffSm) {
  let lo = 0;
  let hi = indexed.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (indexed[mid].serviceMinute < cutoffSm) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function lineMeta(routeNumber, stationId) {
  if (/^L\d+$/i.test(routeNumber)) {
    const lrLines = getLightRailLinesForStation(stationId);
    const hit = lrLines.find((l) => l.route === routeNumber);
    if (hit) return hit;
  }
  if (/^M\d+$/i.test(routeNumber)) {
    const metroLines = getMetroLinesForStation(stationId);
    const hit = metroLines.find((l) => l.route === routeNumber);
    if (hit) return hit;
  }
  if (isBusRoute(routeNumber, { mode: "bus" })) {
    const busLines = getBusLinesForStation(stationId);
    const hit = busLines.find((l) => l.route === routeNumber);
    if (hit) return hit;
    return {
      color: "#00B5EF",
      name: `Route ${routeNumber}`,
    };
  }
  return (
    SYDNEY_TRANSIT_LINES.find((l) => l.route === routeNumber) || {
      color: /^L\d/i.test(routeNumber) ? "#E62B1E" : "#888888",
      name: routeNumber,
    }
  );
}

/** All departures from service-day start through end of service day. */
export function getDayScheduleRows(stationId, now = new Date(), limit = 5000) {
  const indexed = getIndexedStationRows(stationId);
  if (!indexed.length) return [];

  const dayStart = sydneyServiceDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const out = [];

  for (const entry of indexed) {
    const when = whenFromServiceMinute(entry.serviceMinute, now);
    if (when.getTime() < dayStart.getTime() || when.getTime() >= dayEnd.getTime()) continue;
    out.push({ row: entry.row, when, index: entry.index });
    if (out.length >= limit) break;
  }

  return out;
}

/** Last N departures before now (service day only). Fast — binary search on indexed rows. */
export function getRecentPastScheduleRows(stationId, now = new Date(), limit = 5) {
  const indexed = getIndexedStationRows(stationId);
  if (!indexed.length || limit <= 0) return [];

  const cutoffSm = currentServiceMinute(now);
  const endIdx = firstIndexAtOrAfterServiceMinute(indexed, cutoffSm);
  const startIdx = Math.max(0, endIdx - limit);
  const out = [];

  for (let i = startIdx; i < endIdx; i++) {
    const entry = indexed[i];
    out.push({
      row: entry.row,
      when: whenFromServiceMinute(entry.serviceMinute, now),
      index: entry.index,
    });
  }

  return out;
}

/** Rows for trip planning: optional recent past + all remaining services until end of day. */
export function getScheduleRowsForTripPlan(
  stationId,
  now = new Date(),
  { includePast = false, pastLimit = 5, upcomingLimit = 3000 } = {}
) {
  const past = includePast ? getRecentPastScheduleRows(stationId, now, pastLimit) : [];
  const upcoming = getRestOfDayScheduleRows(stationId, now, upcomingLimit);
  if (!past.length) return upcoming;

  const seen = new Set();
  const merged = [];
  for (const entry of [...past, ...upcoming]) {
    const key = `${entry.row.routeNumber}|${entry.row.destination}|${entry.when.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }
  return merged.sort((a, b) => a.when.getTime() - b.when.getTime());
}

/** Remaining services from now until end of the Sydney service day (04:00 next day). */
export function getRestOfDayScheduleRows(stationId, now = new Date(), limit = 3000) {
  const indexed = getIndexedStationRows(stationId);
  if (!indexed.length) return [];

  const cutoffSm = Math.max(0, currentServiceMinute(now) - 2);
  const dayEnd = new Date(sydneyServiceDayStart(now).getTime() + 24 * 3600 * 1000);
  const startIdx = firstIndexAtOrAfterServiceMinute(indexed, cutoffSm);
  const out = [];

  for (let i = startIdx; i < indexed.length && out.length < limit; i++) {
    const entry = indexed[i];
    const when = whenFromServiceMinute(entry.serviceMinute, now);
    if (when.getTime() >= dayEnd.getTime()) continue;
    out.push({ row: entry.row, when, index: entry.index });
  }

  return out;
}

function fillLightRailRowsFromBranch(stationId, data) {
  if (!/_LR$/i.test(stationId)) return data.stations[stationId]?.departures || [];
  if (data.stations[stationId]?.departures?.length) {
    return data.stations[stationId].departures;
  }

  for (const route of ["L1", "L2", "L3"]) {
    const branchIds = LIGHT_RAIL_LINE_STATION_IDS[route] || [];
    const idx = branchIds.indexOf(stationId);
    if (idx === -1) continue;

    let donorId = null;
    let donorIdx = -1;
    for (let d = 1; d < branchIds.length; d++) {
      if (branchIds[idx - d] && data.stations[branchIds[idx - d]]?.departures?.length) {
        donorId = branchIds[idx - d];
        donorIdx = idx - d;
        break;
      }
      if (branchIds[idx + d] && data.stations[branchIds[idx + d]]?.departures?.length) {
        donorId = branchIds[idx + d];
        donorIdx = idx + d;
        break;
      }
    }
    if (!donorId) continue;

    const offsetMin = (idx - donorIdx) * 4;
    const donorRows = data.stations[donorId].departures.filter(
      (r) => String(r.routeNumber || "").toUpperCase() === route
    );
    if (!donorRows.length) continue;

    return donorRows.map((row) => {
      const [h, m] = String(row.scheduledTime || "00:00").split(":").map(Number);
      let total = h * 60 + m + offsetMin;
      while (total < 0) total += 24 * 60;
      while (total >= 24 * 60) total -= 24 * 60;
      const hh = String(Math.floor(total / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      return {
        ...row,
        scheduledTime: `${hh}:${mm}`,
        source: row.source || "branch-fill",
      };
    });
  }

  return [];
}

function fillMetroRowsFromBranch(stationId, data) {
  if (!/_M$/i.test(stationId)) return data.stations[stationId]?.departures || [];
  if (data.stations[stationId]?.departures?.length) {
    return data.stations[stationId].departures;
  }

  for (const route of ["M1"]) {
    const branchIds = METRO_LINE_STATION_IDS[route] || [];
    const idx = branchIds.indexOf(stationId);
    if (idx === -1) continue;

    let donorId = null;
    let donorIdx = -1;
    for (let d = 1; d < branchIds.length; d++) {
      if (branchIds[idx - d] && data.stations[branchIds[idx - d]]?.departures?.length) {
        donorId = branchIds[idx - d];
        donorIdx = idx - d;
        break;
      }
      if (branchIds[idx + d] && data.stations[branchIds[idx + d]]?.departures?.length) {
        donorId = branchIds[idx + d];
        donorIdx = idx + d;
        break;
      }
    }
    if (!donorId) continue;

    const offsetMin = (idx - donorIdx) * 3;
    const donorRows = data.stations[donorId].departures.filter(
      (r) => String(r.routeNumber || "").toUpperCase() === route
    );
    if (!donorRows.length) continue;

    return donorRows.map((row) => {
      const [h, m] = String(row.scheduledTime || "00:00").split(":").map(Number);
      let total = h * 60 + m + offsetMin;
      while (total < 0) total += 24 * 60;
      while (total >= 24 * 60) total -= 24 * 60;
      const hh = String(Math.floor(total / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      return {
        ...row,
        scheduledTime: `${hh}:${mm}`,
        source: row.source || "branch-fill",
      };
    });
  }

  return [];
}

/** Today's services that have not yet reached terminus (upcoming + in progress). */
export function getActiveScheduledRows(stationId, now = new Date(), limit = 80) {
  const nowMs = now.getTime();
  const upcoming = getUpcomingScheduledRows(stationId, now, limit * 2);
  const dayRows = getDayScheduleRows(stationId, now, Math.max(limit * 4, 200));

  const inProgress = dayRows.filter(({ when, row }) => {
    const depMs = when.getTime();
    if (depMs > nowMs - 30_000) return false;
    return estimateServiceEndMs(stationId, row, when) >= nowMs - 60_000;
  });

  const seen = new Set();
  const merged = [];
  for (const entry of [...inProgress, ...upcoming]) {
    const key = `${entry.row.routeNumber}|${entry.row.destination}|${entry.when.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, limit);
}

export function getUpcomingScheduledRows(stationId, now = new Date(), limit = 40) {
  return getRestOfDayScheduleRows(stationId, now, limit);
}

function scheduledRowsToDepartures(station, stationId, entries, { lite = false } = {}) {
  return entries.map(({ row, when: schedTime, index }) => {
    const route = row.routeNumber || "T1";
    const mode = /^L\d+/i.test(route)
      ? "light_rail"
      : /^M\d/i.test(route)
        ? "metro"
        : isBusRoute(route, station)
          ? "bus"
          : station?.mode === "metro"
            ? "metro"
            : station?.mode === "lightrail" || station?.mode === "light_rail"
              ? "light_rail"
              : "train";
    const line = lineMeta(route, stationId);
    const timedStops =
      !lite && buildDepartureStopSequence(station, stationId, row, schedTime);
    const stops = lite
      ? [
          {
            station_name: station?.name || stationId,
            time: toIsoString(schedTime),
          },
          {
            station_name: row.destination,
            time: toIsoString(schedTime),
          },
        ]
      : timedStops?.length >= 2
        ? timedStops
        : buildMockStopsForDeparture(
            station,
            stationId,
            row.destination,
            route,
            mode,
            schedTime,
            schedTime,
            row
          );
    return {
      id: `pdf_${route}_${stationId}_${row.scheduledTime.replace(":", "")}_${index}`,
      routeNumber: route,
      destination: row.destination,
      mode,
      scheduledTime: toIsoString(schedTime),
      realTime: toIsoString(schedTime),
      delayMinutes: 0,
      platform: row.platform ? String(row.platform) : "—",
      status: "on_time",
      lineColor: line.color,
      lineName: line.name,
      stops,
    };
  });
}

/** Scheduled departures from imported PDF timetables (per-station file load). */
export function buildCustomDepartures(station, stationId, count = 40) {
  const now = new Date();
  const upcoming = getActiveScheduledRows(stationId, now, count * 3).slice(0, count);
  return scheduledRowsToDepartures(station, stationId, upcoming);
}

/** Full rest-of-day timetable from Transport NSW PDF/GTFS imports. */
export function buildFullDayDepartures(station, stationId, limit = 3000) {
  const now = new Date();
  const rows = getRestOfDayScheduleRows(stationId, now, limit);
  return scheduledRowsToDepartures(station, stationId, rows, { lite: true });
}

export function buildPdfDeparturesPayload(station, stationId, count = 40) {
  const departures = buildCustomDepartures(station, stationId, count);
  if (!departures.length) return null;
  return timetablePayload(station, departures, "timetable-pdf");
}

export function buildFullDayDeparturesPayload(station, stationId, limit = 3000) {
  const departures = buildFullDayDepartures(station, stationId, limit);
  if (!departures.length) return null;
  return timetablePayload(station, departures, "timetable-pdf-fullday");
}

function timetablePayload(station, departures, sourceBase) {
  return {
    source: isSydneyWeekend() ? "timetable-pdf-weekday" : sourceBase,
    departures,
    meta: {
      scheduleSource:
        station?.mode === "bus"
          ? "transportnsw-gtfs-weekday"
          : station?.mode === "metro"
            ? "transportnsw-gtfs"
            : "transportnsw-pdf",
      dayType: "weekday",
      fullDay: sourceBase.includes("fullday"),
      weekendNote: isSydneyWeekend()
        ? "Showing weekday PDF times — use live board when available"
        : null,
      refreshedAt: new Date().toISOString(),
    },
  };
}

/** Overlay TfNSW live times onto scheduled PDF/GTFS rows (same route + destination). */
export function mergeLiveOntoSchedule(scheduled, live) {
  if (!scheduled?.length) return live || [];
  if (!live?.length) return scheduled;

  const livePool = [...live];
  const usedLive = new Set();

  const normDest = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/,\s*(sydney|newcastle|wollongong|parramatta)$/i, "")
      .replace(/\s+station$/i, "")
      .trim();

  const findLiveMatch = (sched) => {
    const schedMs = parseTfnswTime(sched.scheduledTime).getTime();
    const schedDest = normDest(sched.destination);
    let best = null;
    let bestDelta = 12 * 60_000;
    for (let i = 0; i < livePool.length; i++) {
      if (usedLive.has(i)) continue;
      const lv = livePool[i];
      if (lv.routeNumber !== sched.routeNumber) continue;
      const liveDest = normDest(lv.destination);
      if (liveDest !== schedDest && !liveDest.includes(schedDest) && !schedDest.includes(liveDest)) {
        continue;
      }
      const liveMs = parseTfnswTime(lv.realTime ?? lv.scheduledTime).getTime();
      const delta = Math.abs(liveMs - schedMs);
      if (delta <= bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    if (best == null) return null;
    usedLive.add(best);
    return livePool[best];
  };

  const merged = scheduled.map((sched) => {
    const lv = findLiveMatch(sched);
    if (!lv) return sched;
    return {
      ...sched,
      realTime: lv.realTime ?? lv.scheduledTime,
      delayMinutes: lv.delayMinutes ?? 0,
      platform: lv.platform && lv.platform !== "—" ? lv.platform : sched.platform,
      status: lv.status ?? sched.status,
      lineColor: lv.lineColor ?? sched.lineColor,
      stops: lv.stops?.length >= 2 ? lv.stops : sched.stops,
      _live: true,
    };
  });

  for (let i = 0; i < livePool.length; i++) {
    if (usedLive.has(i)) continue;
    merged.push(livePool[i]);
  }

  return merged.sort(
    (a, b) =>
      parseTfnswTime(a.realTime ?? a.scheduledTime).getTime() -
      parseTfnswTime(b.realTime ?? b.scheduledTime).getTime()
  );
}

export function getCustomTimetableMeta() {
  const lr = warmLightRailTimetables();
  const metro = warmMetroTimetables();
  const lrStations = lr.stations || {};
  const metroStations = metro.stations || {};
  return {
    lightRailStations: Object.keys(lrStations).length,
    lightRailDepartures: Object.values(lrStations).reduce((n, s) => n + s.departures.length, 0),
    metroStations: Object.keys(metroStations).length,
    metroDepartures: Object.values(metroStations).reduce((n, s) => n + s.departures.length, 0),
  };
}
