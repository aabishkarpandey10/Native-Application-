import { config, isTfnswKeyConfigured } from "../config/index.js";
import { formatItdDateTime } from "../../data/tfnswHelpers.js";
import {
  cacheGetStale,
  cacheKeyForDepartures,
  cacheSetWithStale,
} from "./cache.service.js";
import { fetchStationDepartures } from "../../data/departuresService.js";
import { shouldThrottleTfnsw } from "../../data/tfnswRequestGate.js";

let outageMode = false;

export async function testTfnswConnection() {
  if (!isTfnswKeyConfigured()) return false;
  try {
    const { dateStr, timeStr } = formatItdDateTime(new Date());
    const url = `${config.tfnsw.baseUrl}/departure_mon?outputFormat=rapidJSON&mode=direct&type_dm=stop&name_dm=10101100&itdDate=${dateStr}&itdTime=${timeStr}&TfNSWDM=true`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Apikey ${config.tfnsw.apiKey}`,
        Accept: "application/json",
      },
    });
    outageMode = !response.ok;
    return response.ok;
  } catch {
    outageMode = true;
    return false;
  }
}

export function isOutageMode() {
  return outageMode;
}

/** Cached departures with per-station TfNSW throttling */
export async function getDeparturesWithCache(
  stationId,
  { forceRefresh = false, fullDay = false } = {}
) {
  const cacheKey = `${cacheKeyForDepartures(stationId)}${fullDay ? ":fullday" : ""}`;
  const cached = await cacheGetStale(cacheKey);

  if (!forceRefresh && cached.data && !cached.stale) {
    return {
      ...cached.data,
      meta: { ...(cached.data.meta || {}), cache: "hit", stale: false },
    };
  }

  const throttled =
    !forceRefresh &&
    !fullDay &&
    isTfnswKeyConfigured() &&
    shouldThrottleTfnsw(stationId);

  if (!throttled && isTfnswKeyConfigured()) {
    try {
      const live = await fetchStationDepartures(stationId, config.tfnsw.apiKey, {
        fullDay,
        forceRefresh,
      });
      await cacheSetWithStale(cacheKey, live, fullDay ? 45 : undefined);
      outageMode = live.source === "mock";
      return {
        ...live,
        meta: { ...(live.meta || {}), cache: "miss", stale: false },
      };
    } catch (err) {
      console.warn("[TfNSW] poll failed:", err.message);
      outageMode = true;
    }
  }

  if (!forceRefresh && cached.data) {
    return {
      ...cached.data,
      meta: { ...(cached.data.meta || {}), cache: "stale", stale: true, outage: outageMode },
    };
  }

  const live = await fetchStationDepartures(stationId, config.tfnsw.apiKey, {
    fullDay,
    forceRefresh,
  });
  await cacheSetWithStale(cacheKey, live, fullDay ? 45 : undefined);
  return {
    ...live,
    meta: { ...(live.meta || {}), cache: "fallback", stale: false, outage: outageMode },
  };
}
