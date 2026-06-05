/** TfNSW Trip Planner helpers (NSW product classes + stop resolution) */

import { parseApiTime, toIsoString, getSydneyItdDateTime } from "./tfnswTime.js";
import { extractSydneyLineCode, getLineColor } from "./lineColors.js";

const stopIdCache = new Map();

function normalizeQueryName(name) {
  return String(name || "")
    .replace(/,\s*Sydney$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStopSearchTerms(stationName) {
  const base = normalizeQueryName(stationName);
  const terms = new Set([base]);
  terms.add(base.replace(/\s+(Station|Stop|Wharf|Interchange)$/i, "").trim());
  terms.add(base.replace(/\s+Metro$/i, "").trim());
  terms.add(base.replace(/\s+Light Rail(?:\s+stop)?$/i, "").trim());
  terms.add(base.replace(/\s+Grand Concourse$/i, "").trim());
  return [...terms].filter((x) => x && x.length >= 3);
}

function modeNameHints(stationMode) {
  if (stationMode === "ferry") return ["wharf", "ferry"];
  if (stationMode === "metro") return ["metro"];
  if (stationMode === "lightrail" || stationMode === "light_rail") return ["light rail", "lightrail", "tram"];
  if (stationMode === "train") return ["station"];
  if (stationMode === "bus") return ["stand", "interchange", "opposite", "before", "after"];
  return [];
}

function scoreStopCandidate(loc, station, stationMode) {
  const name = String(loc.name || loc.disassembledName || "").toLowerCase();
  const stationName = normalizeQueryName(station?.name).toLowerCase();
  const hints = modeNameHints(stationMode);
  let score = 0;

  if (name.includes(stationName)) score += 3;
  if (stationName.includes(name)) score += 2;
  if (loc.type === "stop") score += 1;
  if (stationMode === "train") {
    if (!name.includes("metro")) score += 2;
    if (name.includes("station") && !/\bstand\b|\binterchange\b/i.test(name)) score += 5;
    if (/\bstand\b|\binterchange\b|\b(at|opp|before|after)\b/i.test(name)) score -= 8;
    if (name.includes("metro")) score -= 4;
  }
  if (stationMode === "metro" && name.includes("metro")) score += 4;
  if (stationMode === "ferry" && name.includes("wharf")) score += 4;
  if (stationMode === "lightrail" || stationMode === "light_rail") {
    if (name.includes("light rail") || name.includes("lightrail") || name.includes("tram")) {
      score += 5;
    }
    if (/\bwharf\b|\bstand\b|\binterchange\b|\b(at|opp|before|after)\b/i.test(name)) {
      score -= 8;
    }
  }
  if (stationMode === "bus" && /\b(at|opp|before|after)\b/i.test(name)) score += 1;

  for (const hint of hints) {
    if (name.includes(hint)) score += 1;
  }

  return score;
}

async function stopHasModeDepartures(stopId, stationMode, apiKey, apiBase) {
  if (!stopId || !stationMode) return false;
  try {
    const { dateStr, timeStr } = getSydneyItdDateTime(new Date());
    const url = `${apiBase}/departure_mon?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&mode=direct&type_dm=stop&name_dm=${stopId}&itdDate=${dateStr}&itdTime=${timeStr}&TfNSWDM=true`;
    const response = await fetch(url, {
      headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) return false;
    const data = await response.json();
    const events = data.stopEvents || [];
    return events.some((ev) => matchesStationMode(ev, stationMode));
  } catch {
    return false;
  }
}

/** NSW rapidJSON product.class → app mode (null if unknown) */
export function mapProductClass(productClass) {
  switch (productClass) {
    case 1:
      return "train";
    case 2:
      return "metro";
    case 4:
      return "light_rail";
    case 5:
    case 7:
    case 700:
    case 714:
      return "bus";
    case 401:
      return "metro";
    case 900:
      return "light_rail";
    case 9:
      return "ferry";
    default:
      return null;
  }
}

/** Infer mode from route number / name when product class is missing or ambiguous */
export function inferEventMode(event) {
  const transportation = event.transportation || {};
  const fromClass = mapProductClass(transportation.product?.class);
  if (fromClass) return fromClass;

  const route = normalizeRouteNumber(transportation);
  if (/^F\d+/i.test(route)) return "ferry";
  if (/^M\d+/i.test(route)) return "metro";
  if (/^L\d+/i.test(route)) return "light_rail";
  if (/^T\d+/i.test(route)) return "train";
  if (/^(CCN|BMT|SCO|HUN|SPL)$/i.test(route)) return "train";
  if (/^\d{3}$/.test(route)) return "bus";

  const name = (transportation.name || transportation.disassembledName || "").toLowerCase();
  if (name.includes("ferry")) return "ferry";
  if (name.includes("metro")) return "metro";
  if (name.includes("light rail") || name.includes("lightrail")) return "light_rail";
  if (name.includes("bus")) return "bus";

  return null;
}

function normalizeStationMode(mode) {
  if (!mode) return null;
  return mode === "lightrail" ? "light_rail" : mode;
}

export function normalizeRouteNumber(transportation) {
  return extractSydneyLineCode(transportation);
}

export function stationModeToProductClass(mode) {
  switch (mode) {
    case "train":
      return 1;
    case "metro":
      return 2;
    case "lightrail":
    case "light_rail":
      return 4;
    case "bus":
      return 5;
    case "ferry":
      return 9;
    default:
      return null;
  }
}

export function matchesStationMode(event, stationMode) {
  if (!stationMode) return true;
  const want = normalizeStationMode(stationMode);
  const transportation = event.transportation || {};
  const rawClass = transportation.product?.class;
  const route = normalizeRouteNumber(transportation);
  const got = inferEventMode(event);

  if (want === "train") {
    if (rawClass === 2 || got === "metro" || /^M\d/i.test(route)) return false;
    if (
      rawClass === 1 ||
      got === "train" ||
      /^T\d/i.test(route) ||
      /^(CCN|BMT|SCO|HUN|SPL)$/i.test(route)
    ) {
      return true;
    }
    return false;
  }

  if (want === "metro") {
    if (rawClass === 1 && got !== "metro" && !/^M\d/i.test(route)) return false;
    if (rawClass === 2 || got === "metro" || /^M\d/i.test(route)) return true;
    return false;
  }

  if (want === "light_rail") {
    if (got === "light_rail") return true;
    if (/^L\d/i.test(route)) return true;
    if (rawClass === 4 || rawClass === 900) return true;
    return false;
  }

  if (!got) return false;
  return got === want;
}

export function parseStopEvent(event, stationId) {
  const plannedTime = parseApiTime(event.departureTimePlanned);
  const estTime = event.departureTimeEstimated
    ? parseApiTime(event.departureTimeEstimated)
    : plannedTime;
  const delay = Math.max(0, Math.round((estTime.getTime() - plannedTime.getTime()) / 60000));

  const transportation = event.transportation || {};
  const route = normalizeRouteNumber(transportation);
  const rawClass = transportation.product?.class;
  let mode = mapProductClass(rawClass) || inferEventMode(event) || "train";
  if (rawClass === 2) mode = "metro";
  else if (rawClass === 1) mode = "train";
  const knownLine = /^(T\d+|M\d+|L\d+|F\d+|CCN|BMT|SCO|HUN|SPL|\d{3})$/i.test(route);
  const color = knownLine
    ? getLineColor(route)
    : transportation.properties?.color || "#555555";
  const dest = (transportation.destination?.name || "Terminus")
    .replace(/, Sydney|, Newcastle|, Wollongong|, Parramatta/g, "")
    .trim();

  let stops = [];
  if (
    event.onwardStopSequences?.[0]?.stops &&
    Array.isArray(event.onwardStopSequences[0].stops)
  ) {
    stops = event.onwardStopSequences[0].stops.map((st) => {
      const raw =
        st.departureTimeEstimated ||
        st.departureTimePlanned ||
        st.arrivalTimeEstimated ||
        st.arrivalTimePlanned;
      return {
        station_name: st.name.replace(/, Sydney|, Newcastle|, Wollongong/g, "").trim(),
        time: toIsoString(parseApiTime(raw)),
      };
    });
  }

  return {
    id: `real_dep_${route}_${plannedTime.getTime()}_${stationId}`,
    routeNumber: route,
    destination: dest,
    mode,
    scheduledTime: toIsoString(plannedTime),
    realTime: toIsoString(estTime),
    delayMinutes: delay,
    platform: event.location?.properties?.platform || event.location?.properties?.plannedPlatformName || "—",
    status: delay > 0 ? "delayed" : "on_time",
    lineColor: color,
    lineName: transportation.name || route,
    stops,
    _productClass: rawClass,
  };
}

export async function resolveTfnswStopId(station, apiKey, apiBase, mappedStopId) {
  if (!station) return null;
  const cached = stopIdCache.get(station.id);
  if (cached) return cached;

  if (mappedStopId) {
    stopIdCache.set(station.id, mappedStopId);
    return mappedStopId;
  }

  const mapped = station.tfnswStopId;
  if (mapped) {
    stopIdCache.set(station.id, mapped);
    return mapped;
  }

  const searchTerms = buildStopSearchTerms(station.name);
  try {
    const byId = new Map();
    for (const term of searchTerms) {
      const sfType = station.mode === "bus" ? "any" : "stop";
      const url = `${apiBase}/stop_finder?outputFormat=rapidJSON&coordOutputFormat=EPSG%3A4326&type_sf=${sfType}&name_sf=${encodeURIComponent(term)}&TfNSWDM=true`;
      const response = await fetch(url, {
        headers: { Authorization: `Apikey ${apiKey}`, Accept: "application/json" },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const locations = (data.locations || []).filter(
        (loc) => loc.type === "stop" && loc.properties?.stopId
      );
      for (const loc of locations) {
        if (!byId.has(loc.properties.stopId)) {
          byId.set(loc.properties.stopId, loc);
        }
      }
    }

    const candidates = [...byId.values()];
    if (candidates.length === 0) return null;

    const ranked = candidates
      .map((loc) => ({
        loc,
        score: scoreStopCandidate(loc, station, station.mode),
      }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.loc);

    const probeCount = Math.min(5, ranked.length);
    for (let i = 0; i < probeCount; i++) {
      const stopId = ranked[i]?.properties?.stopId;
      if (!stopId) continue;
      const ok = await stopHasModeDepartures(stopId, station.mode, apiKey, apiBase);
      if (ok) {
        stopIdCache.set(station.id, stopId);
        return stopId;
      }
    }

    const id = ranked[0]?.properties?.stopId;
    if (id) {
      stopIdCache.set(station.id, id);
      return id;
    }
  } catch {
    // ignore
  }
  return null;
}

export { getSydneyItdDateTime as formatItdDateTime };
