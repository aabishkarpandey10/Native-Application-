import { useEffect, useRef, useCallback, useState } from "react";
import { getApiBaseUrl } from "../config/api";

export type RealtimeEvent =
  | { event: "connected"; payload: { clientId: string; heartbeatMs: number } }
  | { event: "ping"; payload: { ts: number } }
  | { event: "departures.update"; payload: { stationId: string; departures?: unknown[] } }
  | { event: "subscribed"; payload: { stationIds: string[] } }
  | { event: "error"; payload: { message: string } };

function wsUrl(): string {
  const base = getApiBaseUrl().replace(/^http/, "ws");
  return `${base}/ws/v1`;
}

export function useRealtimeDepartures(stationIds: string[]) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);
  const [updates, setUpdates] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback((ids: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && ids.length) {
      wsRef.current.send(JSON.stringify({ event: "subscribe", payload: { stationIds: ids } }));
    }
  }, []);

  useEffect(() => {
    if (typeof WebSocket === "undefined") return;

    let backoff = 1000;
    const connect = () => {
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        backoff = 1000;
        subscribe(stationIds);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as RealtimeEvent;
          if (msg.event === "ping") {
            ws.send(JSON.stringify({ event: "pong", payload: { ts: Date.now() } }));
            return;
          }
          if (msg.event === "departures.update") {
            setUpdates((prev) => ({ ...prev, [msg.payload.stationId]: msg.payload }));
          }
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };

      ws.onerror = () => setError("WebSocket connection failed");
    };

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [stationIds.join(","), subscribe]);

  useEffect(() => {
    subscribe(stationIds);
  }, [stationIds, subscribe, connected]);

  return { connected, updates, error };
}
