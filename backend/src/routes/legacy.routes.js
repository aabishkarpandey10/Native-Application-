import { getAppConfig, getStations } from "../../data/adminStore.js";
import { filterStationsByQuery } from "../../data/stationSearch.js";
import { SYDNEY_TRAIN_LINES, LINE_STATION_IDS } from "../../data/sydneyNetworks.js";
import { getServiceAlerts } from "../../data/alertsService.js";
import { config } from "../config/index.js";
import { getDeparturesWithCache } from "../services/tfnswIngestion.service.js";
import { registerTripRoutes } from "./trip.routes.js";
import { registerNearbyRoutes } from "./nearby.routes.js";

export function registerLegacyRoutes(router, _deps) {
  router.get("/app-config", (_req, res) => {
    res.json(getAppConfig());
  });

  router.get("/stops", (req, res) => {
    const stations = getStations().filter((s) => !s.disabled);
    const query = req.query.q || req.query.query;
    if (!query) return res.json({ stops: stations, version: "v1" });
    res.json({ stops: filterStationsByQuery(stations, String(query).toLowerCase()), version: "v1" });
  });

  router.get("/routes", (_req, res) => {
    res.json({ routes: SYDNEY_TRAIN_LINES, version: "v1" });
  });

  router.get("/routes/:routeId/stops", (req, res) => {
    const ids = LINE_STATION_IDS[req.params.routeId] || [];
    const stations = getStations().filter((s) => ids.includes(s.id) && !s.disabled);
    res.json({ routeId: req.params.routeId, stops: stations, version: "v1" });
  });

  router.get("/timetables", async (req, res, next) => {
    try {
      const stationId = req.query.stopId || req.query.stationId;
      if (!stationId) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "stopId required" });
      }
      const data = await getDeparturesWithCache(String(stationId));
      res.json({ timetable: data, version: "v1" });
    } catch (err) {
      next(err);
    }
  });

  router.get("/alerts", async (req, res, next) => {
    try {
      const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
      res.setHeader("Cache-Control", "no-store, max-age=0");
      const payload = await getServiceAlerts(config.tfnsw.apiKey, { forceRefresh });
      res.json({ ...payload, version: "v1" });
    } catch (err) {
      next(err);
    }
  });

  registerNearbyRoutes(router);
  registerTripRoutes(router);
}
