import { planTripsForStations, parseTripPlannerQuery } from "../../data/tripPlanCore.js";
import { buildMockTripItineraries } from "../../data/tripPlanMock.js";
import { config } from "../config/index.js";

export function registerTripRoutes(router) {
  router.get("/trip-planner", handleTripPlanner);
}

async function handleTripPlanner(req, res) {
  const parsed = parseTripPlannerQuery(req);
  if (parsed.error) {
    return res
      .status(parsed.error.status)
      .json({ error: "VALIDATION_ERROR", message: parsed.error.message });
  }

  try {
    res.setHeader("Cache-Control", "private, max-age=30");
    const result = await planTripsForStations(
      parsed.origin,
      parsed.dest,
      parsed.departDate,
      config.tfnsw.apiKey,
      config.tfnsw.baseUrl,
      {
        includePast: parsed.includePast,
        fullDay: parsed.fullDay,
        forceRefresh: parsed.forceRefresh,
        buildMockItineraries: config.allowMockData ? buildMockTripItineraries : undefined,
      }
    );
    return res.json({
      itineraries: result.itineraries,
      version: "v1",
      meta: result.meta,
    });
  } catch (err) {
    console.warn("[TripPlanner]", err.message);
    return res.status(500).json({ error: "TRIP_PLANNER_ERROR", message: err.message });
  }
}
