# Production deployment guide

End-to-end steps to deploy the Sydney Transit backend on the internet and ship Android/iOS builds that connect to it.

## Architecture

```
┌─────────────────┐     HTTPS      ┌──────────────────────┐
│  Expo app (APK) │ ──────────────►│  Express backend     │
│  EXPO_PUBLIC_   │                │  PORT from platform  │
│  API_URL        │                │  HOST=0.0.0.0        │
└─────────────────┘                └──────────┬───────────┘
                                              │
                                              ▼
                                   TfNSW Open Data API
```

All mobile API traffic goes through **`src/config/api.ts`** → **`src/services/apiClient.ts`**. There are no hardcoded production URLs in feature code.

---

## Issues found and fixes applied

| Area | Issue | Fix |
|------|-------|-----|
| Release APK | `localhost` in baked URL points at the phone, not your PC | `getApiBaseUrl()` uses baked `EXPO_PUBLIC_API_URL` only in release; startup diagnostics warn |
| Release APK | LAN IP only works on same Wi‑Fi | Documented; use public HTTPS for store builds |
| EAS store builds | Private/HTTP URLs blocked | `app.config.js` fails `production` profile builds without HTTPS public URL |
| Android HTTP | Cleartext blocked by default | `expo-build-properties` sets `usesCleartextTraffic` when API URL is `http://` |
| Backend bind | Must listen on all interfaces | `HOST=0.0.0.0`, `app.listen(PORT, HOST)` |
| Backend PORT | Platform injects `PORT` | `config.port = Number(process.env.PORT) \|\| 3000` |
| CORS | Wide open in all envs | `backend/src/middlewares/cors.js` — env `CORS_ORIGIN` in production |
| Proxy headers | Render/Railway need trust proxy | `app.set("trust proxy", 1)` |
| JWT | Default dev secret in production | `validateProductionConfig()` exits on insecure `JWT_SECRET` |
| Raw fetch | Some services bypassed logging | `aiService`, `adminApi`, `useAssistantLiveBoard` → `apiClient` |
| Docker health | Old path | Healthcheck uses `/api/health` |
| Mock data | Demo data in prod | `ALLOW_MOCK_DATA=false` default; client rejects mock sources |

---

## 1. Deploy the backend

### Required environment variables

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `PORT` | Set by host (Render/Railway/Fly inject this) |
| `HOST` | `0.0.0.0` |
| `TFNSW_API_KEY` | Your key from [opendata.transport.nsw.gov.au](https://opendata.transport.nsw.gov.au/) |
| `JWT_SECRET` | Random string, min 32 characters |
| `ALLOW_MOCK_DATA` | `false` |
| `PUBLIC_URL` | `https://your-api.example.com` (optional, for logs) |
| `CORS_ORIGIN` | `*` or comma-separated web origins |

Optional: `OPENAI_API_KEY` (assistant), `ENABLE_ADMIN=true` + `ADMIN_PASSWORD` (admin panel).

### Option A — Render

1. Push repo to GitHub.
2. In Render: **New → Blueprint** and connect the repo (uses `render.yaml`), **or** **New Web Service** with Docker, Dockerfile path `backend/Dockerfile`, context `.`.
3. Set `TFNSW_API_KEY` and `PUBLIC_URL` in the dashboard.
4. Deploy. Note the URL, e.g. `https://sydney-transit-api.onrender.com`.

Verify:

```bash
curl https://YOUR-API.onrender.com/api/health
```

Expected: `{"ok":true,...}`

### Option B — Railway

1. Connect GitHub repo to Railway.
2. Railway reads `railway.toml` and builds `backend/Dockerfile`.
3. Add env vars in Railway dashboard (same table above).
4. Copy the generated public URL.

### Option C — Docker (VPS / Fly.io)

```bash
docker build -f backend/Dockerfile -t sydney-transit-api .
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e TFNSW_API_KEY=your_key \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  sydney-transit-api
```

Put HTTPS in front (Caddy, nginx, or Fly's automatic TLS).

### Option D — Local production smoke test

```bash
cd backend
set NODE_ENV=production
set TFNSW_API_KEY=your_key
set JWT_SECRET=your-long-random-secret
node server.js
```

---

## 2. Configure the mobile app

### Development (Expo Go)

In `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
```

Expo Go rewrites `localhost` to your PC's LAN IP automatically.

### Release APK (same Wi‑Fi testing)

Before building, set your PC's LAN IP in `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
```

Then rebuild — the URL is **baked at build time**:

```bash
npm run setup:env
npm run build:android:release
```

Output: `build-output/sydney-transit-release.apk`

### Production / Play Store (public HTTPS)

1. Deploy backend (step 1).
2. Set URL in `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-api.example.com
```

3. **EAS cloud builds** — store the URL in EAS (not only `.env`):

```bash
eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://your-api.example.com
```

4. Build:

```bash
# Play Store AAB
eas build --profile production --platform android

# Sideload APK (allows LAN URL for internal testing via production-apk profile)
eas build --profile production-apk --platform android
```

Local Gradle release (uses `.env`):

```bash
npm run build:android:release
```

### iOS

```bash
eas build --profile production --platform ios
# or internal IPA:
eas build --profile production-ipa --platform ios
```

Apple credentials must be configured interactively on first run.

---

## 3. Verify integration

With backend running and URL configured:

```bash
npm run verify:live
npm run verify:release-api
```

On device after installing APK:

```bash
adb logcat | findstr /i "API config API]"
```

Look for `[API config]` — issues array should be empty for production HTTPS URLs.

---

## 4. Configuration reference

### Frontend (single source)

| File | Role |
|------|------|
| `src/config/api.ts` | Resolves `EXPO_PUBLIC_API_URL`, dev LAN rewrite, diagnostics |
| `src/services/apiClient.ts` | All HTTP: `fetchBackendJson`, `fetchBackendRaw`, health check |
| `app.config.js` | Bakes `extra.apiUrl`, cleartext/ATS, EAS validation |
| `.env` / EAS env | `EXPO_PUBLIC_API_URL` at build time |

### Backend

| File | Role |
|------|------|
| `backend/server.js` | Express entry, `0.0.0.0` bind, trust proxy |
| `backend/src/config/index.js` | PORT, HOST, CORS, production validation |
| `backend/src/middlewares/cors.js` | Production CORS from `CORS_ORIGIN` |

---

## 5. Troubleshooting

| Symptom | Cause | Action |
|---------|-------|--------|
| App empty in APK, works in Expo Go | Release uses baked URL; no LAN rewrite | Set `EXPO_PUBLIC_API_URL` before build; rebuild APK |
| `Network request failed` | Wrong URL, firewall, or backend down | `curl /api/health`; check logcat `[API]` lines |
| HTTP works in dev, fails in release | Android cleartext policy | Use HTTPS, or ensure `usesCleartextTraffic` + `npx expo prebuild` |
| EAS build fails on URL | Store profile requires public HTTPS | `eas env:create` with `https://...` |
| Backend won't start on Render | Default JWT secret | Set `JWT_SECRET` in dashboard |
| CORS error in web only | Browser origin blocked | Set `CORS_ORIGIN=https://your-web-app.com` |

---

## 6. Rebuild checklist

When you change `EXPO_PUBLIC_API_URL`:

1. Update `.env` (local builds) and/or EAS env (cloud builds).
2. Run `npx expo prebuild --platform android --clean` if cleartext/HTTPS mode changed.
3. Rebuild APK/AAB.
4. Uninstall old APK from test device (optional but avoids confusion).

When you change backend env vars: redeploy the backend only — no app rebuild needed unless the URL changed.

---

See also: [LIVE_BACKEND_INTEGRATION.md](./LIVE_BACKEND_INTEGRATION.md), [RELEASE.md](./RELEASE.md).
