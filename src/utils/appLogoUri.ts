import type { ImageSource } from "expo-image";
import type { AppConfig } from "../types/appConfig";
import { getBackendUrl } from "../services/apiClient";

const BUNDLED_LOGO = require("@/assets/icon.png");

/** Direct image URLs only — blocks search pages and other non-image links. */
export function sanitizeAppLogoUrl(raw: string | null | undefined): string {
  const url = String(raw ?? "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";

  const lower = url.toLowerCase();
  if (
    /google\.com\/search|bing\.com\/search|duckduckgo\.com\/\?|\/search\?/i.test(lower) ||
    lower.includes("udm=2") ||
    (lower.includes("q=") && lower.includes("sa=x"))
  ) {
    return "";
  }

  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)) {
    return url;
  }

  return "";
}

function uploadedLogoUri(cacheKey: string): ImageSource {
  const base = getBackendUrl().replace(/\/$/, "");
  return {
    uri: `${base}/api/app-logo?v=${encodeURIComponent(cacheKey)}`,
  };
}

export function resolveAppLogoImageSource(config: AppConfig | null | undefined): ImageSource {
  if (config?.appLogoHasUpload || config?.appLogoUpdatedAt) {
    const v = config.appLogoUpdatedAt ?? "upload";
    return uploadedLogoUri(v);
  }

  const url = sanitizeAppLogoUrl(config?.appLogoUrl);
  if (url) return { uri: url };

  return BUNDLED_LOGO;
}

export function appLogoSourceLabel(config: AppConfig | null | undefined): string {
  if (config?.appLogoHasUpload || config?.appLogoUpdatedAt) return "Uploaded logo";
  if (sanitizeAppLogoUrl(config?.appLogoUrl)) return "Custom URL";
  return "Default app icon";
}

