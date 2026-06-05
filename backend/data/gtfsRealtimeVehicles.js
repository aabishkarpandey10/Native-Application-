import GtfsRealtimeBindings from "gtfs-realtime-bindings";

/** TfNSW GTFS-RT vehicle feeds (v1/v2 paths from opendata.transport.nsw.gov.au). */
const GTFS_VEHICLE_FEEDS = [
  {
    url: "https://api.transport.nsw.gov.au/v2/gtfs/vehiclepos/sydneytrains",
    mode: "train",
  },
  {
    url: "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/nswtrains",
    mode: "train",
  },
  {
    url: "https://api.transport.nsw.gov.au/v2/gtfs/vehiclepos/metro",
    mode: "metro",
  },
  {
    url: "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/buses",
    mode: "bus",
  },
  {
    url: "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/lightrail/innerwest",
    mode: "light_rail",
  },
  {
    url: "https://api.transport.nsw.gov.au/v1/gtfs/vehiclepos/ferries/sydneyferries",
    mode: "ferry",
  },
];

const ROUTE_FROM_GTFS = /^(T\d+[A-Z]?|M\d+[A-Z]?|L\d+[A-Z]?|F\d+|[A-Z]{2,4}|\d{2,4}[A-Z]?)/i;

/** Drop positions older than this (seconds). */
const MAX_AGE_SEC = 300;

function routeFromGtfsId(routeId) {
  if (!routeId) return null;
  const raw = String(routeId);
  const m = raw.match(ROUTE_FROM_GTFS);
  if (m) return m[1].toUpperCase();
  const tail = raw.split(":").pop() || raw;
  const m2 = tail.match(ROUTE_FROM_GTFS);
  return m2 ? m2[1].toUpperCase() : tail.slice(0, 8).toUpperCase() || null;
}

function entityAgeSec(entity) {
  const ts = entity.vehicle?.timestamp ?? entity.timestamp;
  if (!ts) return 0;
  return Math.max(0, Math.floor(Date.now() / 1000) - Number(ts));
}

function mapVehicleEntity(entity, feedMode) {
  const pos = entity.vehicle?.position;
  if (!pos) return null;
  const lat = Number(pos.latitude);
  const lon = Number(pos.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const ageSec = entityAgeSec(entity);
  if (ageSec > MAX_AGE_SEC) return null;

  const trip = entity.vehicle?.trip || entity.trip;
  const routeId = trip?.routeId || entity.vehicle?.vehicle?.label;
  const routeNumber =
    routeFromGtfsId(routeId) ||
    routeFromGtfsId(entity.vehicle?.vehicle?.label) ||
    "—";

  const bearing = Number(pos.bearing);
  const speed = Number(pos.speed);

  return {
    id: String(entity.id || `${feedMode}_${lat}_${lon}_${routeNumber}`),
    routeNumber,
    mode: feedMode,
    lat,
    lon,
    bearing: Number.isFinite(bearing) ? bearing : undefined,
    speed: Number.isFinite(speed) ? speed : undefined,
    label: entity.vehicle?.vehicle?.label
      ? String(entity.vehicle.vehicle.label)
      : undefined,
    ageSec,
  };
}

async function fetchVehicleFeed(apiKey, url, mode) {
  const response = await fetch(url, {
    headers: {
      Authorization: `apikey ${apiKey}`,
      Accept: "application/x-protobuf",
    },
    signal: AbortSignal.timeout(28_000),
  });

  if (!response.ok) {
    throw new Error(`GTFS vehiclepos ${url} ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);
  const entities = feedMessage?.entity || [];

  return entities.map((entity) => mapVehicleEntity(entity, mode)).filter(Boolean);
}

/**
 * Live vehicle positions from Transport NSW GTFS-Realtime (same source as transportnsw.info).
 */
export async function fetchTransportNswVehiclePositions(apiKey) {
  if (!apiKey?.trim()) return [];

  const batches = await Promise.allSettled(
    GTFS_VEHICLE_FEEDS.map(({ url, mode }) => fetchVehicleFeed(apiKey, url, mode))
  );

  const merged = [];
  const seen = new Set();

  for (const result of batches) {
    if (result.status !== "fulfilled") {
      console.warn("[GTFS vehicles]", result.reason?.message || result.reason);
      continue;
    }
    for (const v of result.value) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      merged.push(v);
    }
  }

  return merged;
}
