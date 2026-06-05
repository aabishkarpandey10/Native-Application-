/** Direct image URLs only — blocks search pages and other non-image links. */
export function sanitizeImageUrl(raw) {
  const url = String(raw ?? "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return "";

  const lower = url.toLowerCase();
  if (
    /google\.com\/search|bing\.com\/search|duckduckgo\.com\/\?|\/search\?/i.test(lower) ||
    lower.includes("udm=2") ||
    lower.includes("q=") && lower.includes("sa=x")
  ) {
    return "";
  }

  if (/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(url)) {
    return url;
  }

  return "";
}

export function sanitizeNetworkMapUrl(raw) {
  return sanitizeImageUrl(raw);
}

export function sanitizeAppLogoUrl(raw) {
  return sanitizeImageUrl(raw);
}
