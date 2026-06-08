/**
 * Fail Vercel builds early when EXPO_PUBLIC_API_URL is missing or points at localhost.
 * Vercel hosts the static web app only — the Express API runs on Render/Railway/etc.
 */
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const onVercel = process.env.VERCEL === "1";

if (!onVercel) {
  process.exit(0);
}

if (!apiUrl) {
  console.error(`
[Vercel] EXPO_PUBLIC_API_URL is not set.

In Vercel → Project → Settings → Environment Variables, add:
  EXPO_PUBLIC_API_URL = https://your-backend.onrender.com

Also set (recommended):
  EXPO_PUBLIC_API_SAME_ORIGIN = false
`);
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/i.test(apiUrl)) {
  console.error(`
[Vercel] EXPO_PUBLIC_API_URL cannot be localhost in production.
Current value: ${apiUrl}

Set it to your deployed backend URL, e.g. https://your-backend.onrender.com
`);
  process.exit(1);
}

console.log(`[Vercel] EXPO_PUBLIC_API_URL OK → ${apiUrl.replace(/\/$/, "")}`);
