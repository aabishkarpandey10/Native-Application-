import { Router } from "express";
import { authRateLimit } from "../../middlewares/rateLimit.js";
import { requireAuth } from "../../middlewares/auth.js";
import * as authController from "../../controllers/auth.controller.js";
import * as realtimeController from "../../controllers/realtime.controller.js";
import * as favouritesController from "../../controllers/favourites.controller.js";
import * as notificationsController from "../../controllers/notifications.controller.js";
import { registerLegacyRoutes } from "../legacy.routes.js";

export function createV1Router(legacyDeps) {
  const router = Router();

  router.get("/status", realtimeController.getRealtimeStatus);

  router.post("/auth/register", authRateLimit, authController.register);
  router.post("/auth/login", authRateLimit, authController.login);
  router.post("/auth/refresh", authRateLimit, authController.refresh);
  router.get("/auth/me", requireAuth, authController.me);

  router.get("/realtime/departures", realtimeController.getRealtimeDepartures);
  router.get("/realtime/stops/:stopId/departures", realtimeController.getRealtimeDepartures);

  router.get("/favourites", requireAuth, favouritesController.getFavourites);
  router.post("/favourites/stations", requireAuth, favouritesController.postFavouriteStation);
  router.delete("/favourites/stations/:stationId", requireAuth, favouritesController.deleteFavouriteStation);
  router.post("/favourites/trips", requireAuth, favouritesController.postFavouriteTrip);
  router.delete("/favourites/trips/:tripId", requireAuth, favouritesController.deleteFavouriteTrip);

  router.get("/notifications", requireAuth, notificationsController.list);
  router.post("/notifications/register", requireAuth, notificationsController.register);
  router.delete("/notifications/unregister", requireAuth, notificationsController.unregister);

  registerLegacyRoutes(router, legacyDeps);

  return router;
}
