import express from "express";
import cors from "cors";
import { config } from "./config/index.js";
import { apiRateLimit } from "./middlewares/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { createV1Router } from "./routes/v1/index.js";
import { initCache } from "./services/cache.service.js";
import { attachWebSocket } from "./websocket/gateway.js";

export async function createApp() {
  await initCache();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(apiRateLimit);

  app.get("/", (_req, res) => {
    res.json({
      name: "TripView Sydney Transit API",
      status: "ok",
      version: "v1",
      health: "/api/v1/status",
      legacy: "/api/status",
      websocket: config.websocket.path,
      docs: "/api/v1",
    });
  });

  app.use("/api/v1", createV1Router({}));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function startServer(existingApp, registerLegacy) {
  const app = existingApp || (await createApp());
  if (registerLegacy) registerLegacy(app);

  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`TripView API running on port ${config.port}`);
    console.log(`REST v1: http://localhost:${config.port}/api/v1/status`);
    console.log(`WebSocket: ws://localhost:${config.port}${config.websocket.path}`);
  });

  attachWebSocket(server);
  return { app, server };
}
