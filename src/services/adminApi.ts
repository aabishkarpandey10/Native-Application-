import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppConfig } from "../types/appConfig";
import { getBackendUrl } from "./apiClient";

const TOKEN_KEY = "admin_token";

export type AdminAppConfig = AppConfig;

export interface AdminStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  mode: string;
  code?: string;
  disabled?: boolean;
  tfnswStopId?: string;
}

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  mode: string;
  severity: string;
  affectedLine?: string;
  updatedAt?: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers as Record<string, string>),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}

export async function adminLogin(password: string): Promise<void> {
  const { token } = await adminFetch<{ token: string }>("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function adminLogout(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function hasAdminSession(): Promise<boolean> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return !!token;
}

export async function adminGetData() {
  return adminFetch<{
    appConfig: AdminAppConfig;
    stations: AdminStation[];
    alerts: AdminAlert[];
    updatedAt: string;
  }>("/api/admin/data");
}

export async function adminSaveAppConfig(config: AdminAppConfig) {
  return adminFetch<AdminAppConfig>("/api/admin/app-config", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function adminSaveStations(stations: AdminStation[]) {
  return adminFetch<AdminStation[]>("/api/admin/stations", {
    method: "PUT",
    body: JSON.stringify(stations),
  });
}

export async function adminSaveAlerts(alerts: AdminAlert[]) {
  return adminFetch<AdminAlert[]>("/api/admin/alerts", {
    method: "PUT",
    body: JSON.stringify(alerts),
  });
}

export async function adminResetDefaults() {
  return adminFetch("/api/admin/reset", { method: "POST" });
}

export async function adminUploadNetworkMap(imageBase64: string) {
  return adminFetch<{ ok: boolean; networkMapUpdatedAt: string }>("/api/admin/network-map", {
    method: "POST",
    body: JSON.stringify({ imageBase64 }),
  });
}

export async function adminClearNetworkMap() {
  return adminFetch<{ ok: boolean; networkMapUpdatedAt: null }>("/api/admin/network-map", {
    method: "DELETE",
  });
}

export async function adminUploadAppLogo(imageBase64: string) {
  return adminFetch<{ ok: boolean; appLogoUpdatedAt: string }>("/api/admin/app-logo", {
    method: "POST",
    body: JSON.stringify({ imageBase64 }),
  });
}

export async function adminClearAppLogo() {
  return adminFetch<{ ok: boolean; appLogoUpdatedAt: null }>("/api/admin/app-logo", {
    method: "DELETE",
  });
}
