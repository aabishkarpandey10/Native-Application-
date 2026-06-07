# Live Backend Integration Report

This document lists mock/sample data removal, API wiring, cloud build configuration, and verification steps.

## Architecture

| Layer | Role |
|-------|------|
| Expo app | Thin client — all transit data via `EXPO_PUBLIC_API_URL` |
| Express (`backend/server.js`) | Proxies Transport NSW, timetables, alerts |
| SQLite (device) | Offline cache of **previously fetched live** departures only |

There is **no embedded database** in the mobile app for live schedules. The bundled `SYDNEY_STATIONS` list is static stop metadata (IDs/names), not mock departures.

---

## Changes made

### Client — removed mock UI fallbacks

| File | Change |
|------|--------|
| `src/constants/sampleData.ts` | Removed `NEARBY_STATIONS`, `TIMETABLE_CENTRAL`, `JOURNEY_RESULTS`, `SERVICE_ALERTS` fixtures. Kept display types only. |
| `src/app/(tabs)/nearby.tsx` | No sample stops; shows `EmptyState` / `ApiRequestError` when API fails. |
| `src/services/tfnsw.ts` | Removed `getMockData()` and mock itinerary generator. |
| `src/services/dataService.ts` | Rejects `mock` / `mock-fallback` sources; throws on API failure; removed SQLite trip/nearby fallbacks on error. |
| `src/services/apiClient.ts` | `ApiRequestError`, request/response logging (`EXPO_PUBLIC_API_DEBUG`), `/api/health` probe. |
| `src/components/screens/TimetableView.tsx` | Mock source label → error message. |
| `src/components/screens/AlertsFeed.tsx` | Shows real API error text. |
| `src/components/BackendStatusBadge.tsx` | "Mock" → "Scheduled" / "Demo". |

### Backend — mock gated behind env flag

| File | Change |
|------|--------|
| `backend/src/config/index.js` | `ALLOW_MOCK_DATA` (default **false**), `API_REQUEST_LOG`. |
| `backend/data/departuresService.js` | Returns `source: unavailable` instead of mock when flag off. |
| `backend/data/tripPlanCore.js` | Mock trips only when `ALLOW_MOCK_DATA=true`. |
| `backend/server.js` | `/health`, `/api/health`, `/api/status`; nearby uses live departures cache; request logging. |
| `backend/src/routes/nearby.routes.js` | Removed mock next-departure injection. |
| `backend/src/routes/trip.routes.js` | Conditional mock trip builder. |

### Tooling

| File | Purpose |
|------|---------|
| `scripts/verify-live-integration.mjs` | Probes health, departures, alerts, nearby, trip planner |
| `npm run verify:live` | Runs verification against `EXPO_PUBLIC_API_URL` |

---

## Environment variables

### Mobile (baked in at EAS build time)

| Variable | Production requirement |
|----------|------------------------|
| `EXPO_PUBLIC_API_URL` | **Public HTTPS URL** — set via `eas env:create --environment production` |
| `EXPO_PUBLIC_API_DEBUG` | `true` on preview builds for API logs in device/Metro output |
| `EXPO_PUBLIC_ENABLE_ADMIN` | `false` (default in `eas.json`) |
| `EXPO_PUBLIC_ENABLE_ASSISTANT` | `false` (default in `eas.json`) |

`app.config.js` **blocks EAS builds** if `EXPO_PUBLIC_API_URL` is localhost, LAN IP, or HTTP.

### Backend (server `.env`)

| Variable | Purpose |
|----------|---------|
| `TFNSW_API_KEY` | Transport NSW Open Data key (required for live boards) |
| `ALLOW_MOCK_DATA` | `false` in production (default) |
| `API_REQUEST_LOG` | `true` during integration testing |

---

## Health endpoint

```
GET /health
GET /api/health
GET /api/status   (alias)
```

Example response:

```json
{
  "ok": true,
  "status": "healthy",
  "tfnswConfigured": true,
  "tfnswLive": true,
  "dataSource": "https://transportnsw.info",
  "allowMockData": false,
  "port": 3000
}
```

---

## Network permissions

| Platform | Config |
|----------|--------|
| Android | `INTERNET` (implicit); cleartext only when HTTP API URL + `usesCleartextTraffic` in `app.config.js` |
| iOS | ATS allows HTTPS by default; HTTP blocked in release unless configured |
| Production | **HTTPS required** for `EXPO_PUBLIC_API_URL` |

---

## Authentication

| Feature | Token |
|---------|-------|
| Transit API (`/api/*`) | No auth — public read endpoints |
| Push (`/api/push/register`) | Device ID + Expo push token (no JWT) |
| Admin (`/admin`) | `ADMIN_TOKEN` / JWT when `ENABLE_ADMIN=true` |
| Supabase | Optional — only when `EXPO_PUBLIC_SUPABASE_*` set |

---

## Verification commands

```bash
# Local backend + integration probe
npm run backend
npm run verify:live

# Release bundle API URL check
npm run verify:release-api

# Cloud production build
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://YOUR-API-DOMAIN
npx eas-cli build -p android --profile production
```

---

## Success criteria checklist

- [ ] `npm run verify:live` passes with zero failures
- [ ] `/api/departures` returns `source` ≠ `mock`
- [ ] Nearby screen shows real stops or explicit error (never sample Central/Town Hall fixtures)
- [ ] Alerts/departures/trip screens show API errors when backend unreachable
- [ ] EAS production build bundles HTTPS `EXPO_PUBLIC_API_URL`
- [ ] `ALLOW_MOCK_DATA=false` on deployed backend

---

## Cloud deployment note

EAS cloud builds **do not read your local `.env`**. You must set `EXPO_PUBLIC_API_URL` in Expo (`eas env`) before building. The backend must be deployed separately (Docker, VPS, etc.) at that URL with `TFNSW_API_KEY` configured.
