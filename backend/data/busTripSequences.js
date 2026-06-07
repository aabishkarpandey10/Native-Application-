/**
 * Trip-linked bus stop sequences (from GTFS merge). Used to backfill TfNSW legs
 * and departure boards with accurate stop-by-stop times.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BUS_STATION_BY_ID } from "./busNetworkData.js";
import { destinationMatches } from "./timedStopSequence.js";
import { parseTfnswTime, toIsoString } from "./tfnswTime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEQUENCES_PATH = path.join(__dirname, "timetables", "bus-trip-sequences.json");

let cache = null;

function loadSequences() {
  if (cache) return cache;
  if (!fs.existsSync(SEQUENCES_PATH)) {
    cache = { byRoute: {} };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(SEQUENCES_PATH, "utf8"));
    return cache;
  } catch {
    cache = { byRoute: {} };
    return cache;
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function serviceMinute(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  let total = (h || 0) * 60 + (m || 0);
  while (total >= 24 * 60) total -= 24 * 60;
  let sm = total - 4 * 60;
  if (sm < 0) sm += 24 * 60;
  return sm;
}

/** Pick a trip template and emit stop times anchored at depTime. */
export function buildStopSequenceFromTripTemplate({
  routeNumber,
  destinationLabel,
  originStationId,
  depTime,
}) {
  const data = loadSequences();
  const route = String(routeNumber || "").trim();
  const templates = data.byRoute?.[route];
  if (!templates?.length || !originStationId) return null;

  const depMs = depTime instanceof Date ? depTime.getTime() : parseTfnswTime(depTime).getTime();
  const depDate = new Date(depMs);
  const depSm = serviceMinute(
    `${depDate.getHours()}:${String(depDate.getMinutes()).padStart(2, "0")}`
  );

  let best = null;
  let bestScore = -1;

  for (const tpl of templates) {
    if (!tpl.stopIds?.length || tpl.stopIds.length < 2) continue;
    if (destinationLabel && !destinationMatches(destinationLabel, tpl.destination)) continue;

    let originIdx = tpl.stopIds.indexOf(originStationId);
    if (originIdx === -1) {
      const origin = BUS_STATION_BY_ID[originStationId];
      if (origin?.lat != null && origin?.lon != null) {
        let bestKm = Infinity;
        for (let i = 0; i < tpl.stopIds.length; i++) {
          const s = BUS_STATION_BY_ID[tpl.stopIds[i]];
          if (s?.lat == null || s?.lon == null) continue;
          const km = haversineKm(origin.lat, origin.lon, s.lat, s.lon);
          if (km < bestKm) {
            bestKm = km;
            originIdx = i;
          }
        }
        if (bestKm > 0.6) continue;
      } else {
        continue;
      }
    }

    if (originIdx >= tpl.stopIds.length - 1) continue;

    let score = 10;
    if (destinationLabel && destinationMatches(destinationLabel, tpl.destination)) score += 20;
    if (tpl.stopIds[0] === originStationId) score += 5;

    const tplOriginSm = serviceMinute(tpl.originTime);
    const delta = Math.abs(depSm - tplOriginSm);
    score += Math.max(0, 30 - delta);

    if (score > bestScore) {
      bestScore = score;
      best = { tpl, originIdx };
    }
  }

  if (!best) return null;

  const { tpl, originIdx } = best;
  const offsets = tpl.offsetsMin || [];
  const sliceIds = tpl.stopIds.slice(originIdx);
  const sliceOffsets = offsets.slice(originIdx);

  if (sliceIds.length < 2) return null;

  return sliceIds.map((id, i) => {
    const offsetMin = sliceOffsets[i] ?? i * 3;
    const when = new Date(depMs + offsetMin * 60_000);
    return {
      station_name: BUS_STATION_BY_ID[id]?.name || id,
      time: toIsoString(when),
      stopId: id,
    };
  });
}

export function getBusTripSequenceStats() {
  const data = loadSequences();
  const routes = Object.keys(data.byRoute || {});
  const templates = routes.reduce((n, r) => n + (data.byRoute[r]?.length || 0), 0);
  return { routes: routes.length, templates };
}
