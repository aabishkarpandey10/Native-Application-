import { sanitizeAppLogoUrl, sanitizeNetworkMapUrl } from "./networkMapUrlUtil.js";

/** Default app settings — merged on every read/write so new keys appear automatically. */

export const APP_CONFIG_DEFAULTS = {
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

  /** Optional URL to a logo image shown on app startup. Uploaded file takes priority. */
  appLogoUrl: "",
  appLogoUpdatedAt: null,

  /** Direct link to a PNG/JPG/WebP (optional). Uploaded file takes priority. */
  networkMapUrl: "",
  /** Set when an image is uploaded via admin / settings. */
  networkMapUpdatedAt: null,

  showWalkLegsInTrips: false,
};

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function asTheme(value, fallback) {
  const v = String(value ?? "").toLowerCase();
  return v === "light" || v === "dark" ? v : fallback;
}

/** Merge saved config with defaults and sanitize values. */
export function normalizeAppConfig(raw = {}) {
  const d = APP_CONFIG_DEFAULTS;
  return {
    appName: String(raw.appName ?? d.appName).trim() || d.appName,
    tagline: String(raw.tagline ?? d.tagline),
    announcement: String(raw.announcement ?? d.announcement),
    showAnnouncementBanner: asBool(raw.showAnnouncementBanner, d.showAnnouncementBanner),
    maintenanceMode: asBool(raw.maintenanceMode, d.maintenanceMode),
    maintenanceMessage: String(raw.maintenanceMessage ?? d.maintenanceMessage),

    defaultTheme: asTheme(raw.defaultTheme, d.defaultTheme),
    allowUserTheme: asBool(raw.allowUserTheme, d.allowUserTheme),
    accentColor: /^#[0-9A-Fa-f]{6}$/.test(String(raw.accentColor ?? ""))
      ? String(raw.accentColor)
      : d.accentColor,

    notificationsDefaultOn: asBool(raw.notificationsDefaultOn, d.notificationsDefaultOn),
    notificationsHelpText: String(raw.notificationsHelpText ?? d.notificationsHelpText),

    featureTripPlanner: asBool(raw.featureTripPlanner, d.featureTripPlanner),
    featureMaps: asBool(raw.featureMaps, d.featureMaps),
    featureAlerts: asBool(raw.featureAlerts, d.featureAlerts),
    featureFavourites: asBool(raw.featureFavourites, d.featureFavourites),
    featureAiChat: asBool(raw.featureAiChat, d.featureAiChat),

    alertsRefreshSec: clampInt(raw.alertsRefreshSec, 10, 300, d.alertsRefreshSec),
    departuresRefreshSec: clampInt(raw.departuresRefreshSec, 10, 300, d.departuresRefreshSec),
    tripPlanRefreshSec: clampInt(raw.tripPlanRefreshSec, 10, 120, d.tripPlanRefreshSec),

    linkTransportNsw: String(raw.linkTransportNsw ?? d.linkTransportNsw).trim() || d.linkTransportNsw,
    linkOpenData: String(raw.linkOpenData ?? d.linkOpenData).trim() || d.linkOpenData,

    aboutDisclaimer: String(raw.aboutDisclaimer ?? d.aboutDisclaimer),
    settingsMapDescription: String(raw.settingsMapDescription ?? d.settingsMapDescription),

    appLogoUrl: sanitizeAppLogoUrl(raw.appLogoUrl ?? d.appLogoUrl),
    appLogoUpdatedAt: raw.appLogoUpdatedAt
      ? String(raw.appLogoUpdatedAt)
      : null,

    networkMapUrl: sanitizeNetworkMapUrl(raw.networkMapUrl ?? d.networkMapUrl),
    networkMapUpdatedAt: raw.networkMapUpdatedAt
      ? String(raw.networkMapUpdatedAt)
      : null,

    showWalkLegsInTrips: asBool(raw.showWalkLegsInTrips, d.showWalkLegsInTrips),
  };
}
