import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE = __ENV.API_URL || "http://localhost:3000";

export default function () {
  const status = http.get(`${BASE}/api/status`);
  check(status, { "status ok": (r) => r.status === 200 });

  const deps = http.get(`${BASE}/api/departures?stationId=CENTRAL_T`);
  check(deps, {
    "departures 200": (r) => r.status === 200,
    "has departures": (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.departures) || Array.isArray(body);
      } catch {
        return false;
      }
    },
  });

  const trip = http.get(`${BASE}/api/trip?originId=CENTRAL_T&destinationId=TOWNHALL_T`);
  check(trip, { "trip 200": (r) => r.status === 200 });

  sleep(1);
}
