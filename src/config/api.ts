import Constants from "expo-constants";
import { Platform } from "react-native";

/** Resolved API base URL for the Express backend (no trailing slash). */
export function getApiBaseUrl(): string {
  const port = process.env.EXPO_PUBLIC_API_PORT || "3000";
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Web: resolve from the page origin so localhost dev is not stuck on a stale LAN IP in .env
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://127.0.0.1:${port}`;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return `http://${hostname}:${port}`;
    }
    if (configured && !/192\.168\.|10\.\d+\./.test(configured)) {
      return configured.replace(/\/$/, "");
    }
    const scheme = protocol === "https:" ? "https" : "http";
    return `${scheme}://${hostname}:${port}`;
  }

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  // Android emulator: host machine is 10.0.2.2
  if (Platform.OS === "android" && !Constants.isDevice) {
    return `http://10.0.2.2:${port}`;
  }

  return `http://localhost:${port}`;
}

/** WebSocket base URL derived from API URL (http→ws, https→wss). */
export function getWsBaseUrl(): string {
  const api = getApiBaseUrl();
  return api.replace(/^http/, "ws") + "/ws/v1";
}
