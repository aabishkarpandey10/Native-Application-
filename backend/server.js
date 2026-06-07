import express from "express";
import dotenv from "dotenv";
import { createCorsMiddleware } from "./src/middlewares/cors.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildAiChatResponse, streamAiChatResponse } from "./aiHandler.js";
import { fetchStationDepartures } from "./data/departuresService.js";
import { normalizeStationId } from "./data/stationAliases.js";
import { getDeparturesWithCache } from "./src/services/tfnswIngestion.service.js";
import { enrichAiContext } from "./data/aiLiveContext.js";
import { buildLiveBoardByMode } from "./data/aiLiveBoard.js";
import {
  getCoreStations,
  getStationById,
  nearbyBusStops,
  resolveStationsForApi,
} from "./data/stationRegistry.js";
import { getLinesForStation, SYDNEY_TRAIN_LINES, LINE_STATION_IDS } from "./data/sydneyNetworks.js";
import { formatItdDateTime, resolveTfnswStopId } from "./data/tfnswHelpers.js";
import { parseTfnswTime, toIsoString } from "./data/tfnswTime.js";
import { rankNearbyStations } from "./data/nearby.js";
import { buildLineStopSequence } from "./data/stopSequence.js";
import { planTripsForStations, parseTripPlannerQuery } from "./data/tripPlanCore.js";
import { buildMockTripItineraries } from "./data/tripPlanMock.js";
import { getAppConfig, getStations } from "./data/adminStore.js";
import { getServiceAlerts } from "./data/alertsService.js";
import { getLiveVehicles } from "./data/vehiclesService.js";
import { createV1Router } from "./src/routes/v1/index.js";
import { initCache } from "./src/services/cache.service.js";
import { attachWebSocket } from "./src/websocket/gateway.js";
import { apiRateLimit } from "./src/middlewares/rateLimit.js";
import { config, isTfnswKeyConfigured, validateProductionConfig } from "./src/config/index.js";
import { registerAdminRoutes } from "./adminRoutes.js";
import { testTfnswConnection } from "./src/services/tfnswIngestion.service.js";
import {
  registerPushToken,
  unregisterPushToken,
} from "./src/services/notifications.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
// Root .env (from .env.example) then backend/.env overrides
dotenv.config({ path: join(rootDir, ".env") });
dotenv.config({ path: join(__dirname, ".env"), override: true });

const app = express();
const PORT = config.port;
const HOST = config.host;

app.set("trust proxy", 1);
app.use(createCorsMiddleware());
app.use(express.json({ limit: "25mb" }));
app.use(apiRateLimit);

if (config.logRequests) {
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });
}

const TFNSW_API_KEY = config.tfnsw.apiKey;
const TFNSW_API_BASE = config.tfnsw.baseUrl;

await initCache();
app.use("/api/v1", createV1Router({}));

app.get("/", (_req, res) => {
  res.json({
    name: "Sydney Transit API",
    status: "ok",
    health: "/api/health",
    endpoints: [
      "/api/app-config",
      "/api/stations",
      "/api/departures",
      "/api/nearby",
      "/api/alerts",
      "/api/vehicles",
      "/api/trip",
      "/api/ai/chat",
    ],
    admin: "/admin",
  });
});

async function buildHealthPayload() {
  const tfnswConfigured = isTfnswKeyConfigured();
  let tfnswLive = false;
  if (tfnswConfigured) {
    try {
      tfnswLive = await testTfnswConnection();
    } catch {
      tfnswLive = false;
    }
  }
  const liveOrTimetable = tfnswLive
    ? "https://transportnsw.info"
    : tfnswConfigured
      ? "timetable-fallback"
      : "unavailable";
  return {
    ok: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    tfnswConfigured,
    tfnswLive,
    dataSource: liveOrTimetable,
    scheduleSource: tfnswLive ? "transportnsw.info" : "local-timetable",
    openaiConfigured: !!(process.env.OPENAI_API_KEY?.trim()),
    allowMockData: config.allowMockData,
    port: PORT,
  };
}

async function handleHealth(_req, res) {
  try {
    res.json(await buildHealthPayload());
  } catch (err) {
    res.status(503).json({
      ok: false,
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

app.get("/health", handleHealth);
app.get("/api/health", handleHealth);
app.get("/api/status", handleHealth);

app.get("/api/app-config", (_req, res) => {
  res.json(getAppConfig());
});

app.get("/api/light-rail/routes", (_req, res) => {
  import("./data/lightRailNetworkData.js").then((mod) => {
    res.json({
      branches: mod.LIGHT_RAIL_LINE_BRANCHES,
      lineStationIds: mod.LIGHT_RAIL_LINE_STATION_IDS,
      lines: mod.SYDNEY_LIGHT_RAIL_LINES,
      generatedAt: new Date().toISOString(),
    });
  });
});

app.get("/api/metro/routes", (_req, res) => {
  import("./data/metroNetworkData.js").then((mod) => {
    res.json({
      branches: mod.METRO_LINE_BRANCHES,
      lineStationIds: mod.METRO_LINE_STATION_IDS,
      lines: mod.SYDNEY_METRO_LINES,
      generatedAt: new Date().toISOString(),
    });
  });
});

app.get("/api/stations", (req, res) => {
  const mode = req.query.mode?.toString();
  const query = req.query.query?.toString();
  const popular = req.query.popular?.toString();
  const ids = req.query.ids?.toString();
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 100);

  const stations = resolveStationsForApi({
    mode,
    query,
    popular,
    ids,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    limit,
  }).filter((s) => !s.disabled);

  res.json(stations);
});

app.get("/api/nearby", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = parseInt(String(req.query.radius || "2000"), 10);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "Missing or invalid lat/lng query params" });
  }

  const stationList = [
    ...getStations().filter((s) => !s.disabled),
    ...nearbyBusStops(lat, lng, { limit: 60 }),
  ];
  const stops = rankNearbyStations(stationList, lat, lng, radius);
  res.json(stops.slice(0, 20));
});

app.get("/api/lines", (req, res) => {
  res.json(SYDNEY_TRAIN_LINES);
});

app.get("/api/lines/:route/stations", (req, res) => {
  const { route } = req.params;
  const ids = LINE_STATION_IDS[route] || [];
  const stations = getStations().filter((s) => ids.includes(s.id) && !s.disabled);
  res.json(stations);
});

/** Device push registration (no auth — keyed by installation id) */
app.post("/api/push/register", (req, res) => {
  const { expoPushToken, deviceId, commuteAlertsEnabled } = req.body || {};
  if (!expoPushToken) return res.status(400).json({ error: "expoPushToken required" });
  const userId = deviceId ? `device:${deviceId}` : "device:anonymous";
  registerPushToken(userId, {
    expoPushToken,
    commuteAlertsEnabled: commuteAlertsEnabled !== false,
    subscribedRoutes: [],
  });
  res.json({ ok: true });
});

app.delete("/api/push/unregister", (req, res) => {
  const { expoPushToken, deviceId } = req.body || {};
  if (!expoPushToken) return res.status(400).json({ error: "expoPushToken required" });
  const userId = deviceId ? `device:${deviceId}` : "device:anonymous";
  unregisterPushToken(userId, expoPushToken);
  res.status(204).send();
});

// Real-time departures return all train networks (with optional real API fetcher)
app.get("/api/departures", async (req, res) => {
  const { stationId, refresh, fullDay, route } = req.query;
  if (!stationId) return res.status(400).json({ error: "Missing stationId" });
  const id = normalizeStationId(String(stationId));
  const forceRefresh = refresh === "1" || refresh === "true";
  const wantFullDay = fullDay === "1" || fullDay === "true";
  const routeFilter = route ? String(route).trim() : null;
  if (forceRefresh) {
    const { clearDeparturesCache } = await import("./src/services/cache.service.js");
    await clearDeparturesCache(id);
  }
  res.setHeader("Cache-Control", wantFullDay ? "private, max-age=30" : "private, max-age=15");
  const result = await getDeparturesWithCache(id, {
    forceRefresh,
    fullDay: wantFullDay,
    routeFilter,
  });
  res.json(result);
});

// Trip calculator — TfNSW live first, fast timetable fallback
app.get("/api/trip", async (req, res) => {
  try {
    const parsed = parseTripPlannerQuery(req);
    if (parsed.error) {
      return res.status(parsed.error.status).json({ error: parsed.error.message });
    }
    const parsedFullDay = parsed.fullDay;
    res.setHeader(
      "Cache-Control",
      parsedFullDay ? "private, max-age=300" : "private, max-age=60"
    );
    const result = await planTripsForStations(
      parsed.origin,
      parsed.dest,
      parsed.departDate,
      TFNSW_API_KEY,
      TFNSW_API_BASE,
      {
        includePast: parsed.includePast,
        fullDay: parsed.fullDay,
        forceRefresh: parsed.forceRefresh,
        buildMockItineraries: config.allowMockData ? buildMockTripItineraries : undefined,
      }
    );
    res.json(result.itineraries);
  } catch (err) {
    console.error("Trip error:", err);
    res.status(500).json({ error: "Failed to plan trip" });
  }
});

app.get("/api/vehicles", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusM = parseInt(String(req.query.radiusM || req.query.radius || "12000"), 10);
    const limit = parseInt(String(req.query.limit || "80"), 10);
    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng query params" });
    }

    res.setHeader("Cache-Control", "private, max-age=15");
    const payload = await getLiveVehicles({
      mode: req.query.mode?.toString(),
      route: req.query.route?.toString(),
      lat,
      lng,
      radiusM,
      limit,
      forceRefresh,
    });
    res.json(payload);
  } catch (err) {
    console.error("Vehicles error:", err);
    res.status(500).json({ error: "Failed to load live vehicles" });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const payload = await getServiceAlerts(TFNSW_API_KEY, { forceRefresh });
    res.json(payload);
  } catch (err) {
    console.error("Alerts error:", err);
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

app.get("/api/ai/live-board", async (req, res) => {
  try {
    const lat = Number(req.query.lat) || -33.8688;
    const lng = Number(req.query.lng) || 151.2093;
    const favorites = req.query.favorites
      ? JSON.parse(String(req.query.favorites))
      : [];
    const board = await buildLiveBoardByMode({
      lat,
      lng,
      apiKey: TFNSW_API_KEY,
      favorites: Array.isArray(favorites) ? favorites : [],
    });
    res.json(board);
  } catch (err) {
    console.error("Live board error:", err);
    res.status(500).json({ error: "Failed to load live board" });
  }
});

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages = [], context = {}, stream = false } = req.body;
    const tfnswLive = isTfnswKeyConfigured() ? await testTfnswConnection() : false;
    const liveContext = await enrichAiContext(context, TFNSW_API_KEY, tfnswLive);
    if (stream) {
      await streamAiChatResponse(messages, liveContext, res);
      return;
    }
    const { text, source } = await buildAiChatResponse(messages, liveContext);
    res.json({
      response: text,
      source,
      liveAsOf: liveContext.liveSnapshot?.asOf,
      liveSnapshot: liveContext.liveSnapshot,
    });
  } catch (err) {
    console.error("AI chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        error: "AI service failed",
        response: "Sorry, I could not process that request.",
      });
    }
  }
});

const adminEnabled =
  process.env.ENABLE_ADMIN === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.ENABLE_ADMIN !== "false");

if (adminEnabled) {
  registerAdminRoutes(app, { rootDir, __dirname });
} else {
  console.log("[Admin] Disabled in production (set ENABLE_ADMIN=true to enable)");
}

const productionCheck = validateProductionConfig();
for (const w of productionCheck.warnings) console.warn(`[config] ${w}`);
for (const e of productionCheck.errors) console.error(`[config] ${e}`);
if (productionCheck.errors.length && config.nodeEnv === "production") {
  console.error("Refusing to start with invalid production configuration.");
  process.exit(1);
}

const server = app.listen(PORT, HOST, async () => {
  try {
    const { warmLightRailTimetables, warmMetroTimetables, warmBusTimetableIndex } =
      await import("./data/timetableLoader.js");
    const lr = warmLightRailTimetables();
    const metro = warmMetroTimetables();
    console.log(
      `Timetables preloaded: light rail ${Object.keys(lr.stations || {}).length} stops, metro ${Object.keys(metro.stations || {}).length} stops`
    );
    setImmediate(async () => {
      try {
        const { warmBusTimetableFile } = await import("./data/timetableLoader.js");
        const busIndex = warmBusTimetableIndex();
        const count = busIndex?.indexedStops
          ?? Object.keys(busIndex?.stationIndex || {}).filter((id) => /_B$/i.test(id)).length;
        if (count > 0) console.log(`Bus timetable index: ${count} stops`);
        const warmed = warmBusTimetableFile();
        if (warmed.stops > 0) console.log(`Bus timetable data preloaded: ${warmed.stops} stops`);
      } catch (e) {
        console.warn("Bus timetable preload skipped:", e.message);
      }
    });
  } catch (e) {
    console.warn("Light rail timetable preload skipped:", e.message);
  }
  console.log(`Sydney Transit Backend Proxy running on ${HOST}:${PORT}`);
  if (config.publicUrl) console.log(`Public URL: ${config.publicUrl}`);
  console.log(`Health: /api/health`);
  if (isTfnswKeyConfigured()) {
    const live = await testTfnswConnection();
    console.log(
      live
        ? `TfNSW API key loaded — live departures enabled (${TFNSW_API_KEY.slice(0, 12)}...)`
        : `TfNSW API key present but live API test failed — check key at opendata.transport.nsw.gov.au`
    );
  } else {
    console.warn(
      "TfNSW API key NOT set — using mock timetables. Run: npm run setup:env (from .env.example)"
    );
  }
});

attachWebSocket(server);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${PORT} is already in use — the backend is probably already running.\n` +
        `  • Use the app as-is: http://localhost:${PORT}/api/status\n` +
        `  • Or stop the old process, then run npm run backend again:\n` +
        `    Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`
    );
    process.exit(1);
  }
  throw err;
});
