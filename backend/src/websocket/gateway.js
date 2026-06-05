import { WebSocketServer } from "ws";
import { config } from "../config/index.js";
import { getDeparturesWithCache } from "../services/tfnswIngestion.service.js";

const subscriptions = new Map();

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: config.websocket.path });

  wss.on("connection", (ws, req) => {
    const clientId = `${req.socket.remoteAddress}-${Date.now()}`;
    subscriptions.set(clientId, { stations: new Set(), ws });

    ws.send(
      JSON.stringify({
        event: "connected",
        payload: { clientId, heartbeatMs: config.websocket.heartbeatMs },
      })
    );

    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ event: "ping", payload: { ts: Date.now() } }));
      }
    }, config.websocket.heartbeatMs);

    ws.on("message", async (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.event === "pong") return;
        if (msg.event === "subscribe") {
          const stationIds = msg.payload?.stationIds || [];
          subscriptions.get(clientId).stations = new Set(stationIds);
          ws.send(JSON.stringify({ event: "subscribed", payload: { stationIds } }));
          for (const stationId of stationIds) {
            const data = await getDeparturesWithCache(stationId);
            ws.send(JSON.stringify({ event: "departures.update", payload: { stationId, ...data } }));
          }
          return;
        }
        if (msg.event === "unsubscribe") {
          subscriptions.get(clientId).stations.clear();
          ws.send(JSON.stringify({ event: "unsubscribed", payload: {} }));
        }
      } catch {
        ws.send(JSON.stringify({ event: "error", payload: { message: "Invalid message" } }));
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      subscriptions.delete(clientId);
    });
  });

  const broadcastInterval = setInterval(async () => {
    for (const [, sub] of subscriptions) {
      if (sub.ws.readyState !== sub.ws.OPEN || sub.stations.size === 0) continue;
      for (const stationId of sub.stations) {
        try {
          const data = await getDeparturesWithCache(stationId);
          sub.ws.send(
            JSON.stringify({ event: "departures.update", payload: { stationId, ...data } })
          );
        } catch {
          /* skip */
        }
      }
    }
  }, config.tfnsw.pollIntervalMs);

  server.on("close", () => clearInterval(broadcastInterval));

  console.log(`[WebSocket] Listening on ${config.websocket.path}`);
  return wss;
}
