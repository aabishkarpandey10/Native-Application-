import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBaseUrl } from "../config/api";

export interface RealtimeDepartureUpdate {
  stationId: string;
  departures?: unknown[];
  meta?: { source?: string; stale?: boolean; outage?: boolean };
}

interface UseWebSocketRealtimeOptions {
  stationIds: string[];
  enabled?: boolean;
  onUpdate?: (update: RealtimeDepartureUpdate) => void;
}

const MAX_BACKOFF_MS = 30_000;

export function useWebSocketRealtime({
  stationIds,
  enabled = true,
  onUpdate,
}: UseWebSocketRealtimeOptions) {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeDepartureUpdate | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1000);
  const stationIdsRef = useRef(stationIds);
  const onUpdateRef = useRef(onUpdate);

  stationIdsRef.current = stationIds;
  onUpdateRef.current = onUpdate;

  const subscribe = useCallback((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN && stationIdsRef.current.length > 0) {
      ws.send(
        JSON.stringify({ event: "subscribe", payload: { stationIds: stationIdsRef.current } })
      );
    }
  }, []);

  useEffect(() => {
    if (!enabled || stationIds.length === 0) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(getWsBaseUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
        subscribe(ws);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.event === "ping") {
            ws.send(JSON.stringify({ event: "pong", payload: msg.payload }));
            return;
          }
          if (msg.event === "departures.update" && msg.payload) {
            const update = msg.payload as RealtimeDepartureUpdate;
            setLastUpdate(update);
            onUpdateRef.current?.(update);
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled, stationIds.join(","), subscribe]);

  useEffect(() => {
    subscribe(wsRef.current!);
  }, [stationIds.join(","), subscribe]);

  return { connected, lastUpdate };
}
