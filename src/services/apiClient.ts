import { getApiBaseUrl } from "../config/api";

export interface BackendStatus {
  ok: boolean;
  tfnswConfigured?: boolean;
  tfnswLive?: boolean;
  dataSource?: string;
  openaiConfigured?: boolean;
  port?: number;
}

export function getBackendUrl(): string {
  return getApiBaseUrl();
}

export type FetchBackendOptions = RequestInit & { timeoutMs?: number };

export async function fetchBackendJson<T>(
  path: string,
  init?: FetchBackendOptions
): Promise<T | null> {
  const { timeoutMs = 12_000, ...requestInit } = init ?? {};
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(requestInit.headers as Record<string, string>),
      },
    });
    if (!res.ok) {
      console.warn(`[API] ${res.status} ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      console.warn(`[API] unreachable ${path} → ${getApiBaseUrl()}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkBackendHealth(): Promise<BackendStatus | null> {
  return fetchBackendJson<BackendStatus>("/api/status");
}
