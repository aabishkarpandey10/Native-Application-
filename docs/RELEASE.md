# Sydney Transit — release checklist

## Run on device (iOS / Android)

```bash
npm install
npm run setup:env   # copy .env from .env.example, add TFNSW_API_KEY
npm run dev         # backend + Expo — press i or a for simulator

# Native builds
npx expo run:ios
npx expo run:android
```

## Store builds (EAS)

1. Set app name, bundle ID, and icons in `app.json`.
2. Configure `eas.json` submit credentials.
3. `npx eas build --platform ios` / `android`
4. `npx eas submit`

## Before public release

- [x] App icon & splash (`assets/icon.png`, `adaptive-icon.png`, `splash-icon.png`)
- [ ] Set real `com.sydneytransit.app` signing in Apple / Google consoles
- [ ] Privacy policy URL (location + TfNSW data)
- [ ] TfNSW API key in production backend (not in client)
- [x] Admin & assistant gated (`ENABLE_ADMIN`, `EXPO_PUBLIC_ENABLE_*`)
- [x] TfNSW per-station cache + throttle (`TFNSW_MIN_INTERVAL_MS`, `CACHE_TTL_SECONDS`)
- [x] Push notifications via Settings → Service alerts

## Navigation map

| Tab | Purpose |
|-----|---------|
| Trips | Saved journeys and stops with live next departures |
| Stops | Nearest station board + nearby stop list |
| Plan | Journey planner with Save trip |
| Alerts | Service disruptions (pull to refresh) |

Stack: **Departures** (timetable), **Station**, **Map**, **Settings**.
