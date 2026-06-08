/**
 * Vercel build checks — unified deploy (web + API on Vercel) or split deploy (API elsewhere).
 */
const onVercel = process.env.VERCEL === "1";
if (!onVercel) process.exit(0);

const sameOrigin = process.env.EXPO_PUBLIC_API_SAME_ORIGIN === "true";
let apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";

if (sameOrigin && !apiUrl && process.env.VERCEL_URL) {
  apiUrl = `https://${process.env.VERCEL_URL}`;
  process.env.EXPO_PUBLIC_API_URL = apiUrl;
  console.log(`[Vercel] EXPO_PUBLIC_API_SAME_ORIGIN — API URL → ${apiUrl}`);
}

if (!apiUrl) {
  console.error(`
[Vercel] Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_API_SAME_ORIGIN=true (unified web+API deploy).
`);
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/i.test(apiUrl)) {
  console.error(`[Vercel] EXPO_PUBLIC_API_URL cannot be localhost. Current: ${apiUrl}`);
  process.exit(1);
}

console.log(`[Vercel] API URL OK → ${apiUrl.replace(/\/$/, "")}`);
