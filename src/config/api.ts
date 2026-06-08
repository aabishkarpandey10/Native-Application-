import Constants from "expo-constants";
import { Platform } from "react-native";

export type ApiConfigReport = {
  resolvedUrl: string;
  configuredUrl: string | null;
  extraUrl: string | null;
  inlinedEnv: string | null;
  isDev: boolean;
  platform: string;
  buildProfile: string | null;
  issues: string[];
};

function readConfiguredApiUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv;

  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim();
  }

  return undefined;
}

/** Expo dev server host (LAN IP) — Expo Go only; never used in release APK. */
function resolveExpoDevLanHost(): string | null {
  if (!__DEV__) return null;

  const raw =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;

  if (!raw) return null;

  const hostPort = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0];
  const host = hostPort?.split(":")[0]?.trim();
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

function configuredUsesLocalhost(url: string | undefined): boolean {
  if (!url) return true;
  return /localhost|127\.0\.0\.1/i.test(url);
}

function usesSameOriginApi(): boolean {
  return process.env.EXPO_PUBLIC_API_SAME_ORIGIN === "true";
}

export function isPrivateOrLocalHost(url: string): boolean {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i.test(url);
}

function collectIssues(configured: string | undefined, resolved: string): string[] {
  const issues: string[] = [];

  if (!configured) {
    if (usesSameOriginApi() && Platform.OS === "web") {
      return issues;
    }
    issues.push(
      "EXPO_PUBLIC_API_URL was not baked into this build — release APK defaults to an unreachable address"
    );
  } else if (isPrivateOrLocalHost(configured)) {
    if (__DEV__) {
      issues.push(
        "Dev: using a local/LAN API URL. Expo Go rewrites localhost to your PC IP; release APK does not."
      );
    } else if (/localhost|127\.0\.0\.1/i.test(configured)) {
      issues.push(
        "Release APK points to localhost/127.0.0.1 — on a phone that means the phone itself, not your PC"
      );
    } else {
      issues.push(
        "Release APK uses a private LAN IP — only works on the same Wi‑Fi as your backend server"
      );
    }
  }

  if (resolved.startsWith("http://") && !__DEV__ && Platform.OS !== "web") {
    issues.push(
      "API uses HTTP. Release Android requires usesCleartextTraffic (set in app.config.js) — rebuild native project after changing URL"
    );
  }

  if (configured && resolved !== configured.replace(/\/$/, "")) {
    issues.push(`Resolved URL (${resolved}) differs from configured (${configured})`);
  }

  if (!__DEV__ && Platform.OS !== "web" && !configured?.startsWith("https://") && !isPrivateOrLocalHost(configured ?? "")) {
    // public http — warn
    if (configured?.startsWith("http://")) {
      issues.push("Production builds should use HTTPS for EXPO_PUBLIC_API_URL");
    }
  }

  return issues;
}

/** Full report for logs, About screen, and connectivity banner. */
export function getApiConfigReport(): ApiConfigReport {
  const configured = readConfiguredApiUrl() ?? null;
  const resolved = getApiBaseUrl();
  return {
    resolvedUrl: resolved,
    configuredUrl: configured,
    extraUrl:
      typeof Constants.expoConfig?.extra?.apiUrl === "string"
        ? Constants.expoConfig.extra.apiUrl
        : null,
    inlinedEnv: process.env.EXPO_PUBLIC_API_URL?.trim() ?? null,
    isDev: __DEV__,
    platform: Platform.OS,
    buildProfile:
      typeof Constants.expoConfig?.extra?.eas?.buildProfile === "string"
        ? Constants.expoConfig.extra.eas.buildProfile
        : null,
    issues: collectIssues(configured ?? undefined, resolved),
  };
}

/** @deprecated use getApiConfigReport */
export function getApiConfigDiagnostics(): { url: string; issues: string[] } {
  const report = getApiConfigReport();
  return { url: report.resolvedUrl, issues: report.issues };
}

/** Log once at startup — visible in release logcat when EXPO_PUBLIC_API_DEBUG=true or on error. */
let startupLogged = false;
export function logApiConfigStartup(force = false): ApiConfigReport {
  const report = getApiConfigReport();
  if (startupLogged && !force) return report;
  startupLogged = true;

  const debug = __DEV__ || process.env.EXPO_PUBLIC_API_DEBUG === "true";
  const hasReleaseBlocker = report.issues.some((i) =>
    /localhost|127\.0\.0\.1|not baked|private LAN/i.test(i)
  );

  if (debug || hasReleaseBlocker || !__DEV__) {
    console.log("[API config]", JSON.stringify(report, null, 0));
    if (report.issues.length) {
      console.warn("[API config] issues:", report.issues.join(" | "));
    }
  }

  return report;
}

/**
 * Resolved API base URL for the Express backend (no trailing slash).
 *
 * Dev + Expo Go: localhost in .env is rewritten to the Metro LAN IP so the phone reaches your PC.
 * Release APK: uses EXPO_PUBLIC_API_URL exactly as baked at build time — no rewrite.
 */
export function getApiBaseUrl(): string {
  const port = process.env.EXPO_PUBLIC_API_PORT || "3000";
  const configured = readConfiguredApiUrl();

  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (usesSameOriginApi()) {
      return window.location.origin;
    }
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

  // Release native builds: never rewrite — use baked URL only.
  if (!__DEV__) {
    if (configured) return configured.replace(/\/$/, "");
    return `http://127.0.0.1:${port}`;
  }

  // Dev native: Expo Go LAN rewrite when .env says localhost.
  const expoHost = resolveExpoDevLanHost();
  if (configuredUsesLocalhost(configured) && expoHost) {
    return `http://${expoHost}:${port}`;
  }

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (Platform.OS === "android" && !Constants.isDevice) {
    return `http://10.0.2.2:${port}`;
  }

  return `http://127.0.0.1:${port}`;
}

/** WebSocket base URL derived from API URL (http→ws, https→wss). */
export function getWsBaseUrl(): string {
  const api = getApiBaseUrl();
  return api.replace(/^http/, "ws") + "/ws/v1";
}
