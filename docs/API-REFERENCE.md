# TripView API Reference v1

Base URL: `https://api.tripview.example.com`  
WebSocket: `wss://api.tripview.example.com/ws/v1`

---

## Authentication

### POST /api/v1/auth/register
Create account.

**Request**
```json
{
  "email": "commuter@example.com",
  "password": "SecurePass123!",
  "displayName": "Jordan"
}
```

**Response 201**
```json
{
  "user": { "id": "usr_abc", "email": "commuter@example.com", "role": "user" },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "tokenType": "Bearer"
}
```

**Errors**: `400 VALIDATION_ERROR`, `409 EMAIL_EXISTS`  
**Rate limit**: 10 req/min per IP

---

### POST /api/v1/auth/login
**Request**: `{ "email", "password" }`  
**Response 200**: Same as register  
**Errors**: `401 INVALID_CREDENTIALS`

---

### POST /api/v1/auth/refresh
**Request**: `{ "refreshToken": "..." }`  
**Response 200**: `{ "accessToken", "refreshToken", "tokenType" }`

---

### GET /api/v1/auth/me
**Headers**: `Authorization: Bearer <accessToken>`  
**Response 200**: `{ "user": { "id", "email", "role", "displayName" } }`

---

## Routes

### GET /api/v1/routes
List all train/metro/ferry/light-rail routes.

**Response 200**
```json
{
  "routes": [
    { "id": "T1", "name": "North Shore & Western", "mode": "train", "color": "#F6891F" }
  ],
  "version": "v1"
}
```

**Rate limit**: 120 req/min

---

### GET /api/v1/routes/:routeId/stops
**Response 200**
```json
{
  "routeId": "T4",
  "stops": [
    { "id": "CENTRAL_T", "name": "Central Station", "lat": -33.883, "lon": 151.206, "mode": "train" }
  ],
  "version": "v1"
}
```

---

## Stops

### GET /api/v1/stops?q=central
Search stops by name.

**Response 200**
```json
{
  "stops": [{ "id": "CENTRAL_T", "name": "Central Station", "mode": "train" }],
  "version": "v1"
}
```

### GET /api/v1/stops/nearby?lat=-33.87&lng=151.21&limit=10
Nearby stops sorted by distance.

---

## Timetables

### GET /api/v1/timetables?stopId=CENTRAL_T
**Response 200**
```json
{
  "timetable": {
    "stationId": "CENTRAL_T",
    "stationName": "Central Station",
    "departures": [
      {
        "id": "dep_1",
        "route": "T4",
        "destination": "Cronulla",
        "scheduledTime": "14:32",
        "estimatedTime": "14:34",
        "platform": "25",
        "delayMinutes": 2,
        "isRealTime": true
      }
    ],
    "meta": { "source": "transport.nsw.gov.au", "stale": false }
  },
  "version": "v1"
}
```

**Errors**: `400 VALIDATION_ERROR` (missing stopId)

---

## Real-Time

### GET /api/v1/realtime/departures?stationId=CENTRAL_T
Same payload as timetables with `meta` freshness indicators.

### GET /api/v1/realtime/stops/:stopId/departures
Path-param variant.

### GET /api/v1/status
Health check including TfNSW connectivity.

```json
{
  "ok": true,
  "tfnswConfigured": true,
  "tfnswLive": true,
  "dataSource": "transport.nsw.gov.au",
  "outageMode": false,
  "websocketPath": "/ws/v1"
}
```

---

## Trip Planner

### GET /api/v1/trip-planner?originId=CENTRAL_T&destinationId=BONDI_T&departAt=2026-05-30T14:00:00
**Response 200**
```json
{
  "itineraries": [
    {
      "durationMinutes": 22,
      "legs": [
        { "mode": "walk", "from": "Central Station", "to": "Central Station", "durationMinutes": 2 },
        { "mode": "train", "route": "T4", "from": "Central", "to": "Bondi Junction", "durationMinutes": 18 }
      ]
    }
  ],
  "version": "v1"
}
```

---

## Alerts

### GET /api/v1/alerts?refresh=1
**Response 200**
```json
{
  "alerts": [
    {
      "id": "alert_001",
      "title": "T4 delays",
      "description": "Allow extra travel time between Central and Cronulla",
      "severity": "warning",
      "affectedLines": ["T4"],
      "startTime": "2026-05-30T08:00:00+10:00"
    }
  ],
  "version": "v1"
}
```

---

## Favourites (auth required)

### GET /api/v1/favourites
**Response 200**
```json
{
  "stations": [{ "stationId": "CENTRAL_T", "alias": "Work" }],
  "trips": [{ "id": "trip_1", "originId": "CENTRAL_T", "destinationId": "TOWNHALL_T", "alias": "Commute" }]
}
```

### POST /api/v1/favourites/stations
`{ "stationId": "CENTRAL_T", "alias": "Work" }`

### DELETE /api/v1/favourites/stations/:stationId

### POST /api/v1/favourites/trips
`{ "originId", "destinationId", "alias" }`

### DELETE /api/v1/favourites/trips/:tripId

---

## Notifications (auth required)

### POST /api/v1/notifications/register
Register Expo push token.

```json
{ "expoPushToken": "ExponentPushToken[xxx]", "commuteAlertsEnabled": true, "subscribedRoutes": ["T4"] }
```

### DELETE /api/v1/notifications/unregister
`{ "expoPushToken": "..." }`

---

## Legacy Endpoints (backward compatible)

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/status | Health |
| GET | /api/departures?stationId= | Live departures |
| GET | /api/nearby?lat=&lng= | Nearby stops |
| GET | /api/trip?originId=&destinationId= | Trip planner |
| GET | /api/alerts | Service alerts (TfNSW add_info + GTFS-RT trackwork from transportnsw.info; `?refresh=1` forces reload) |
| GET | /api/stations?query= | Stop search |
| POST | /api/ai/chat | AI assistant |

---

## Error Format

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Retry after 45 seconds.",
  "retryAfter": 45
}
```

| Code | HTTP | Description |
|------|------|-------------|
| VALIDATION_ERROR | 400 | Missing/invalid params |
| UNAUTHORIZED | 401 | Missing/invalid token |
| FORBIDDEN | 403 | Insufficient role |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| TFNSW_UNAVAILABLE | 503 | Upstream outage (stale cache returned if available) |

---

## WebSocket Events

Connect: `wss://host/ws/v1`

```javascript
// Subscribe
ws.send(JSON.stringify({ event: "subscribe", payload: { stationIds: ["CENTRAL_T", "TOWNHALL_T"] } }));

// Receive updates
{ "event": "departures.update", "payload": { "stationId": "CENTRAL_T", "departures": [...], "meta": { "stale": false } } }

// Heartbeat
{ "event": "ping", "payload": { "ts": 1717056000000 } }
// Reply: { "event": "pong", "payload": { "ts": 1717056000000 } }
```
