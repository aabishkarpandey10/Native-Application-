import { getStations } from "../../data/adminStore.js";
import { rankNearbyStations } from "../../data/nearby.js";
import { buildMockDepartures } from "../../data/mockDepartures.js";
import { config, isTfnswKeyConfigured } from "../config/index.js";
import { getDeparturesWithCache } from "../services/tfnswIngestion.service.js";

export function registerNearbyRoutes(router) {
  router.get("/stops/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseInt(String(req.query.radius || "2000"), 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "lat and lng required" });
    }
    const stationList = getStations().filter((s) => !s.disabled);
    const stops = rankNearbyStations(stationList, lat, lng, radius);
    const result = await Promise.all(
      stops.map(async (stop) => {
        const station = stationList.find((s) => s.id === stop.station_id);
        if (isTfnswKeyConfigured()) {
          try {
            const live = await getDeparturesWithCache(stop.station_id);
            if (live.departures?.length) {
              return { ...stop, next_departure: live.departures[0] };
            }
          } catch {
            /* mock */
          }
        }
        const deps = buildMockDepartures(station, stop.station_id, 1);
        return { ...stop, next_departure: deps[0] || null };
      })
    );
    res.json({ stops: result, version: "v1" });
  });
}
