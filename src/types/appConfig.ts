/** Remote app settings (admin panel → /api/app-config). */

import { sanitizeNetworkMapUrl } from "../utils/networkMapUri";
import { sanitizeAppLogoUrl } from "../utils/appLogoUri";

export type AppTheme = "light" | "dark";

export interface AppConfig {
  appName: string;
  tagline: string;
  announcement: string;
  showAnnouncementBanner: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;

  defaultTheme: AppTheme;
  allowUserTheme: boolean;
  accentColor: string;

  notificationsDefaultOn: boolean;
  notificationsHelpText: string;

  featureTripPlanner: boolean;
  featureMaps: boolean;
  featureAlerts: boolean;
  featureFavourites: boolean;
  featureAiChat: boolean;

  alertsRefreshSec: number;
  departuresRefreshSec: number;
  tripPlanRefreshSec: number;

  linkTransportNsw: string;
  linkOpenData: string;

  aboutDisclaimer: string;
  settingsMapDescription: string;

  appLogoUrl: string;
  appLogoUpdatedAt: string | null;
  /** Set by API when a logo file exists on the server (not persisted in admin JSON). */
  appLogoHasUpload?: boolean;

  networkMapUrl: string;
  networkMapUpdatedAt: string | null;
  /** Set by API when a map file exists on the server (not persisted in admin JSON). */
  networkMapHasUpload?: boolean;

  showWalkLegsInTrips: boolean;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  appName: "Sydney Transit",
  tagline: "Saved trips, nearby stops & live departures",
  announcement: "",
  showAnnouncementBanner: true,
  maintenanceMode: false,
  maintenanceMessage: "Maintenance mode — some live data may be unavailable",

  defaultTheme: "dark",
  allowUserTheme: true,
  accentColor: "#0079C1",

  notificationsDefaultOn: false,
  notificationsHelpText:
    "When enabled, Sydney Transit requests notification permission and alerts you about new major service disruptions.",

  featureTripPlanner: true,
  featureMaps: true,
  featureAlerts: true,
  featureFavourites: true,
  featureAiChat: true,

  alertsRefreshSec: 20,
  departuresRefreshSec: 30,
  tripPlanRefreshSec: 15,

  linkTransportNsw: "https://transportnsw.info",
  linkOpenData: "https://opendata.transport.nsw.gov.au/",

  aboutDisclaimer:
    "Sydney Transit uses Transport for NSW open data. Timetable accuracy is not guaranteed. Always check platform screens before boarding.",
  settingsMapDescription:
    "Sydney Metropolitan Rail System schematic. View only — pinch to zoom on supported devices.",

  appLogoUrl: "",
  appLogoUpdatedAt: null,

  networkMapUrl: "",
  networkMapUpdatedAt: null,

  showWalkLegsInTrips: false,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function normalizeAppConfig(raw: Partial<AppConfig> | null | undefined): AppConfig {
  const d = APP_CONFIG_DEFAULTS;
  const r = raw ?? {};
  return {
    appName: String(r.appName ?? d.appName).trim() || d.appName,
    tagline: String(r.tagline ?? d.tagline),
    announcement: String(r.announcement ?? d.announcement),
    showAnnouncementBanner: asBool(r.showAnnouncementBanner, d.showAnnouncementBanner),
    maintenanceMode: asBool(r.maintenanceMode, d.maintenanceMode),
    maintenanceMessage: String(r.maintenanceMessage ?? d.maintenanceMessage),

    defaultTheme:
      r.defaultTheme === "light" ? "light" : r.defaultTheme === "dark" ? "dark" : d.defaultTheme,
    allowUserTheme: asBool(r.allowUserTheme, d.allowUserTheme),
    accentColor: /^#[0-9A-Fa-f]{6}$/.test(String(r.accentColor ?? ""))
      ? String(r.accentColor)
      : d.accentColor,

    notificationsDefaultOn: asBool(r.notificationsDefaultOn, d.notificationsDefaultOn),
    notificationsHelpText: String(r.notificationsHelpText ?? d.notificationsHelpText),

    featureTripPlanner: asBool(r.featureTripPlanner, d.featureTripPlanner),
    featureMaps: asBool(r.featureMaps, d.featureMaps),
    featureAlerts: asBool(r.featureAlerts, d.featureAlerts),
    featureFavourites: asBool(r.featureFavourites, d.featureFavourites),
    featureAiChat: asBool(r.featureAiChat, d.featureAiChat),

    alertsRefreshSec: clampInt(r.alertsRefreshSec, 10, 300, d.alertsRefreshSec),
    departuresRefreshSec: clampInt(r.departuresRefreshSec, 10, 300, d.departuresRefreshSec),
    tripPlanRefreshSec: clampInt(r.tripPlanRefreshSec, 10, 120, d.tripPlanRefreshSec),

    linkTransportNsw: String(r.linkTransportNsw ?? d.linkTransportNsw).trim() || d.linkTransportNsw,
    linkOpenData: String(r.linkOpenData ?? d.linkOpenData).trim() || d.linkOpenData,

    aboutDisclaimer: String(r.aboutDisclaimer ?? d.aboutDisclaimer),
    settingsMapDescription: String(r.settingsMapDescription ?? d.settingsMapDescription),

    appLogoUrl: sanitizeAppLogoUrl(String(r.appLogoUrl ?? d.appLogoUrl)),
    appLogoUpdatedAt: r.appLogoUpdatedAt ? String(r.appLogoUpdatedAt) : null,
    appLogoHasUpload:
      typeof r.appLogoHasUpload === "boolean" ? r.appLogoHasUpload : false,

    networkMapUrl: sanitizeNetworkMapUrl(String(r.networkMapUrl ?? d.networkMapUrl)),
    networkMapUpdatedAt: r.networkMapUpdatedAt ? String(r.networkMapUpdatedAt) : null,
    networkMapHasUpload:
      typeof r.networkMapHasUpload === "boolean" ? r.networkMapHasUpload : false,

    showWalkLegsInTrips: asBool(r.showWalkLegsInTrips, d.showWalkLegsInTrips),
  };
}
