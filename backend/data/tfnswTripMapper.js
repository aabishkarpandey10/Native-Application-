import { parseApiTime, parseTfnswTime, toIsoString } from "./tfnswTime.js";
import {
  inferEventMode,
  mapProductClass,
  normalizeRouteNumber,
} from "./tfnswHelpers.js";
import { buildLineStopSequence } from "./stopSequence.js";
import { findBranchPath } from "./trainNetworkPath.js";
import { normalizeItineraryTimes } from "./tripPlanner.js";

const BUS_PRODUCT_CLASSES = new Set([5, 7, 700, 714]);

function resolveRouteNumber(transportation) {
  const normalized = normalizeRouteNumber(transportation);
  if (normalized && normalized !== "—") return normalized;
  const direct = String(transportation?.number || "").trim();
  return direct || "";
}

function normalizeLightRailRoute(routeNo, destinationName = "", transportName = "") {
  const route = String(routeNo || "").toUpperCase();
  if (/^L[123]$/.test(route)) return route;
  const text = `${destinationName} ${transportName}`.toLowerCase();
  if (text.includes("dulwich")) return "L1";
  if (text.includes("kingsford") || text.includes("juniors")) return "L3";
  if (text.includes("randwick")) return "L2";
  return "L2";
}

/** Classify a TfNSW trip leg; keep bus legs when product class indicates bus. */
export function resolveTfnswLegMode(leg, routeNo) {
  const transportation = leg.transportation || {};
  const rawClass = transportation.product?.class;
  const hasTransport =
    transportation.number ||
    transportation.name ||
    transportation.disassembledName ||
    rawClass != null;

  if (!hasTransport) return "walk";

  const fromClass = mapProductClass(rawClass);
  const inferred = inferEventMode({ transportation });
  let mode = fromClass || inferred || "bus";

  if (mode === "bus" && (!routeNo || routeNo === "—")) {
    if (BUS_PRODUCT_CLASSES.has(rawClass) || fromClass === "bus" || inferred === "bus") {
      return "bus";
    }
    return "walk";
  }

  return mode;
}

export function mapTfnswTripLeg(leg, origin, dest) {
  const depTime = parseApiTime(
    leg.origin.departureTimeEstimated || leg.origin.departureTimePlanned
  );
  const arrTime = parseApiTime(
    leg.destination.arrivalTimeEstimated || leg.destination.arrivalTimePlanned
  );
  const dur = Math.max(0, Math.round((arrTime.getTime() - depTime.getTime()) / 60000));
  const routeNo = resolveRouteNumber(leg.transportation);
  let legMode = resolveTfnswLegMode(leg, routeNo);

  const originMode = origin.mode === "lightrail" ? "light_rail" : origin.mode;
  const destMode = dest.mode === "lightrail" ? "light_rail" : dest.mode;
  if (
    (originMode === "light_rail" || destMode === "light_rail") &&
    (originMode === "light_rail" && destMode === "light_rail") &&
    legMode !== "walk"
  ) {
    legMode = "light_rail";
  }

  let stops = [];
  let stopTimes = [];
  if (leg.stopSequence && Array.isArray(leg.stopSequence)) {
    stopTimes = leg.stopSequence
      .map((st) => {
        const raw =
          st.departureTimeEstimated ||
          st.departureTimePlanned ||
          st.arrivalTimeEstimated ||
          st.arrivalTimePlanned;
        if (!raw) return null;
        const coord =
          st.coord ||
          st.location?.coord ||
          st.properties?.coord ||
          null;
        let lat;
        let lon;
        if (Array.isArray(coord) && coord.length >= 2) {
          lon = Number(coord[0]);
          lat = Number(coord[1]);
        }
        const row = {
          station_name: st.name.replace(/, Sydney|, Newcastle|, Wollongong/g, "").trim(),
          time: toIsoString(parseApiTime(raw)),
        };
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          row.lat = lat;
          row.lon = lon;
        }
        if (st.id) row.stopId = String(st.id);
        return row;
      })
      .filter(Boolean);
    stops = stopTimes.map((st) => st.station_name);
  }

  let finalRouteNumber = routeNo;
  // Skip heavy PDF stop expansion during trip search when TfNSW already sent a sequence.
  const skipStopExpansion = stops.length >= 2;

  if (!skipStopExpansion && legMode === "train" && origin?.id && dest?.id) {
    const path = findBranchPath(origin.id, dest.id, routeNo || null);
    if (path) {
      finalRouteNumber = path.route;
      const seq = buildLineStopSequence({
        originStationId: origin.id,
        destinationLabel: dest.name.replace(/ Station$/i, ""),
        lineRoute: path.route,
        schedTime: depTime,
        minutesPerStop: 4,
      });
      if (seq.length >= 2) {
        stopTimes = seq;
        stops = seq.map((s) => s.station_name);
      }
    }
  }

  if (!skipStopExpansion && legMode === "light_rail") {
    finalRouteNumber = normalizeLightRailRoute(
      routeNo,
      leg.transportation?.destination?.name || "",
      leg.transportation?.name || ""
    );
    if (stops.length <= 2) {
      const seq = buildLineStopSequence({
        originStationId: origin.id,
        destinationLabel: dest.name.replace(/ Light Rail stop$/i, "").replace(/ Station$/i, ""),
        lineRoute: finalRouteNumber,
        schedTime: depTime,
        minutesPerStop: 4,
      });
      if (seq.length >= 2) {
        stopTimes = seq;
        stops = seq.map((s) => s.station_name);
      }
    }
  }

  return {
    mode: legMode,
    originName: leg.origin.name.replace(/, Sydney/g, "").trim(),
    destinationName: leg.destination.name.replace(/, Sydney/g, "").trim(),
    originId: leg.origin.id,
    destinationId: leg.destination.id,
    departureTime: toIsoString(depTime),
    arrivalTime: toIsoString(arrTime),
    durationMinutes: dur,
    platform:
      leg.origin.properties?.platform || leg.origin.properties?.plannedPlatformName || "",
    destinationPlatform:
      leg.destination.properties?.platform ||
      leg.destination.properties?.plannedPlatformName ||
      "",
    routeNumber: finalRouteNumber || "",
    stops,
    stopTimes,
    originStopId: leg.origin?.id ? String(leg.origin.id) : undefined,
    destinationStopId: leg.destination?.id ? String(leg.destination.id) : undefined,
  };
}

export function mapTfnswJourneys(journeys, origin, dest) {
  return journeys.map((jny, idx) => {
    const legs = jny.legs.map((leg) => mapTfnswTripLeg(leg, origin, dest));
    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];
    const tripDep = parseTfnswTime(firstLeg.departureTime);
    const tripArr = parseTfnswTime(lastLeg.arrivalTime);
    const totalDuration = Math.max(0, Math.round((tripArr.getTime() - tripDep.getTime()) / 60000));

    return normalizeItineraryTimes({
      id: `real_trip_${idx}_${origin.id}_${dest.id}`,
      totalDurationMinutes: totalDuration,
      departureTime: firstLeg.departureTime,
      arrivalTime: lastLeg.arrivalTime,
      isLive: true,
      legs,
      transfersCount: Math.max(0, legs.filter((l) => l.mode !== "walk").length - 1),
    });
  });
}

export function calcTfnswTripCount(origin, dest, includePast = false) {
  if (includePast) return 12;
  const modes = [origin?.mode, dest?.mode].map((m) =>
    m === "lightrail" ? "light_rail" : m
  );
  if (modes.includes("bus")) return 10;
  return 8;
}
