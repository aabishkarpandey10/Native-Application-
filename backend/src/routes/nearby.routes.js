import { getStations } from "../../data/adminStore.js";
import { nearbyBusStops } from "../../data/stationRegistry.js";
import { rankNearbyStations } from "../../data/nearby.js";

export function registerNearbyRoutes(router) {
  router.get("/stops/nearby", async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseInt(String(req.query.radius || "2000"), 10);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "lat and lng required" });
    }
    const stationList = [
      ...getStations().filter((s) => !s.disabled),
      ...nearbyBusStops(lat, lng, { limit: 60 }),
    ];
    const stops = rankNearbyStations(stationList, lat, lng, radius);
    res.json({ stops: stops.slice(0, 20), version: "v1" });
  });
}
