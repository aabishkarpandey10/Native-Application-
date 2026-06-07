import Constants from "expo-constants";
import { Platform } from "react-native";
import { getApiBaseUrl, getApiConfigReport, isPrivateOrLocalHost } from "../config/api";

export interface BackendStatus {
  ok: boolean;
  status?: string;
  tfnswConfigured?: boolean;
  tfnswLive?: boolean;
  dataSource?: string;
  scheduleSource?: string;
  openaiConfigured?: boolean;
  port?: number;
  uptime?: number;
  apiUrl?: string;
  allowMockData?: boolean;
  timestamp?: string;
}

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly path: string;
  readonly url: string;
  readonly responseBody?: string;
  readonly hint?: string;

  constructor(
    message: string,
    details: {
      status?: number;
      path: string;
      url: string;
      responseBody?: string;
      hint?: string;
    }
  ) {
    const full = details.hint ? `${message} — ${details.hint}` : message;
    super(full);
    this.name = "ApiRequestError";
    this.status = details.status;
    this.path = details.path;
    this.url = details.url;
    this.responseBody = details.responseBody;
    this.hint = details.hint;
  }
}

export function getBackendUrl(): string {
  return getApiBaseUrl();
}

/** Build full URL for a backend path (used by asset helpers). */
export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function isApiDebugLoggingEnabled(): boolean {
  return __DEV__ || process.env.EXPO_PUBLIC_API_DEBUG === "true";
}

function networkHint(url: string, message: string): string | undefined {
  if (__DEV__) return undefined;

  if (/localhost|127\.0\.0\.1/i.test(url)) {
    return "Release APK cannot use localhost — rebuild with EXPO_PUBLIC_API_URL set to your server address";
  }
  if (isPrivateOrLocalHost(url) && /network request failed|failed to fetch|timed out/i.test(message)) {
    return "LAN URL only works on the same Wi‑Fi as your backend, or use a public HTTPS URL";
  }
  if (url.startsWith("http://") && Platform.OS === "android") {
    return "HTTP blocked? Run expo prebuild and rebuild APK after setting usesCleartextTraffic in app.config.js";
  }
  return undefined;
}

function logApiSuccess(message: string, extra?: Record<string, unknown>) {
  if (!isApiDebugLoggingEnabled()) return;
  if (extra) console.log(`[API] ${message}`, extra);
  else console.log(`[API] ${message}`);
}

function logApiFailure(message: string, extra?: Record<string, unknown>) {
  // Always log failures — essential for diagnosing release APK issues via logcat / adb logcat
  if (extra) console.warn(`[API] ${message}`, extra);
  else console.warn(`[API] ${message}`);
}

export type FetchBackendOptions = RequestInit & {
  timeoutMs?: number;
  /** When false, returns null instead of throwing (optional endpoints only). */
  throwOnError?: boolean;
};

export async function fetchBackendRaw(
  path: string,
  init?: FetchBackendOptions
): Promise<Response | null> {
  const { timeoutMs = 12_000, throwOnError = true, ...requestInit } = init ?? {};
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logApiSuccess(`→ ${method} ${normalizedPath}`, { url });

  const fail = (message: string, details: { status?: number; responseBody?: string }) => {
    const hint = networkHint(url, message);
    logApiFailure(`✗ ${method} ${normalizedPath}: ${message}`, {
      url,
      status: details.status,
      hint,
      body: details.responseBody?.slice(0, 400),
    });
    if (!throwOnError) return null;
    throw new ApiRequestError(message, {
      status: details.status,
      path: normalizedPath,
      url,
      responseBody: details.responseBody,
      hint,
    });
  };

  try {
    const res = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
    });

    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      return fail(`HTTP ${res.status}`, { status: res.status, responseBody }) as null;
    }

    logApiSuccess(`← ${method} ${normalizedPath} ${res.status}`);
    return res;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return fail(`Timed out after ${timeoutMs}ms`, {}) as null;
    }
    if (err instanceof ApiRequestError) throw err;
    return fail((err as Error).message || "Network request failed", {}) as null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBackendJson<T>(
  path: string,
  init?: FetchBackendOptions
): Promise<T | null> {
  const { timeoutMs = 12_000, throwOnError = true, ...requestInit } = init ?? {};
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;
  const method = (requestInit.method ?? "GET").toUpperCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logApiSuccess(`→ ${method} ${normalizedPath}`, { url });

  const fail = (message: string, details: { status?: number; responseBody?: string }) => {
    const hint = networkHint(url, message);
    logApiFailure(`✗ ${method} ${normalizedPath}: ${message}`, {
      url,
      status: details.status,
      hint,
      body: details.responseBody?.slice(0, 400),
      appVersion: Constants.expoConfig?.version,
      build: Constants.expoConfig?.extra?.eas?.buildProfile ?? "local",
    });
    if (!throwOnError) return null;
    throw new ApiRequestError(message, {
      status: details.status,
      path: normalizedPath,
      url,
      responseBody: details.responseBody,
      hint,
    });
  };

  try {
    const res = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(requestInit.headers as Record<string, string>),
      },
    });

    const responseBody = await res.text();
    if (!res.ok) {
      return fail(`HTTP ${res.status}`, { status: res.status, responseBody }) as T | null;
    }

    if (!responseBody.trim()) {
      logApiSuccess(`← ${method} ${normalizedPath} ${res.status} (empty)`);
      return null;
    }

    let parsed: T;
    try {
      parsed = JSON.parse(responseBody) as T;
    } catch {
      return fail("Invalid JSON response", { status: res.status, responseBody }) as T | null;
    }

    logApiSuccess(`← ${method} ${normalizedPath} ${res.status}`, {
      bytes: responseBody.length,
    });
    return parsed;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return fail(`Timed out after ${timeoutMs}ms`, {}) as T | null;
    }
    if (err instanceof ApiRequestError) throw err;
    return fail((err as Error).message || "Network request failed", {}) as T | null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkBackendHealth(): Promise<BackendStatus | null> {
  const report = getApiConfigReport();
  try {
    const status = await fetchBackendJson<BackendStatus>("/api/health", { timeoutMs: 10_000 });
    if (status?.ok) return status;
  } catch (err) {
    logApiFailure("health /api/health failed", {
      error: (err as Error).message,
      url: report.resolvedUrl,
    });
  }

  try {
    return await fetchBackendJson<BackendStatus>("/api/status", { timeoutMs: 10_000 });
  } catch (err) {
    logApiFailure("health /api/status failed", {
      error: (err as Error).message,
      url: report.resolvedUrl,
      configIssues: report.issues,
    });
    return null;
  }
}

/** Reject demo/mock payloads in production client builds. */
export function assertLiveDataSource(source: string | null | undefined, path: string): void {
  if (!source || source === "cached") return;
  if (source !== "mock" && source !== "mock-fallback") return;
  throw new ApiRequestError(
    `Backend returned demo data (${source}). Configure TFNSW_API_KEY on the server and set ALLOW_MOCK_DATA=false.`,
    { path, url: getApiBaseUrl() }
  );
}
