import type { ImageSource } from "expo-image";
import type { AppConfig } from "../types/appConfig";
import { buildApiUrl } from "../services/apiClient";

const BUNDLED_MAP = require("@/assets/images/sydney-metropolitan-rail-map.jpg");

/** Direct image URLs only — blocks search pages and other non-image links. */
export function sanitizeNetworkMapUrl(raw: string | null | undefined): string {
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

function uploadedMapUri(config: AppConfig, cacheKey: string): ImageSource {
  return {
    uri: buildApiUrl(`/api/network-map?v=${encodeURIComponent(cacheKey)}`),
  };
}

/** Resolve schematic map source: uploaded file → valid image URL → bundled default. */
export function resolveNetworkMapImageSource(
  config: AppConfig | null | undefined
): ImageSource {
  if (config?.networkMapHasUpload || config?.networkMapUpdatedAt) {
    const v = config.networkMapUpdatedAt ?? "upload";
    return uploadedMapUri(config, v);
  }

  const url = sanitizeNetworkMapUrl(config?.networkMapUrl);
  if (url) {
    return { uri: url };
  }

  return BUNDLED_MAP;
}

/** Ordered fallbacks when the primary source fails to load. */
export function resolveNetworkMapImageFallbacks(
  config: AppConfig | null | undefined
): ImageSource[] {
  const sources: ImageSource[] = [];
  const primary = resolveNetworkMapImageSource(config ?? null);
  sources.push(primary);

  const hasUpload = config?.networkMapHasUpload || config?.networkMapUpdatedAt;
  const url = sanitizeNetworkMapUrl(config?.networkMapUrl);

  if (hasUpload && url) {
    sources.push({ uri: url });
  }

  const isBundled =
    typeof primary === "number" ||
    (typeof primary === "object" && primary !== null && !("uri" in primary));
  if (!isBundled) {
    sources.push(BUNDLED_MAP);
  }

  return sources;
}

export function networkMapSourceLabel(config: AppConfig | null | undefined): string {
  if (config?.networkMapHasUpload || config?.networkMapUpdatedAt) return "Uploaded image";
  if (sanitizeNetworkMapUrl(config?.networkMapUrl)) return "Custom URL";
  return "Default map";
}
