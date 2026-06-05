import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "30s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE = __ENV.API_URL || "http://localhost:3000";

export default function () {
  const status = http.get(`${BASE}/api/v1/status`);
  check(status, { "status 200": (r) => r.status === 200 });

  const stops = http.get(`${BASE}/api/v1/stops?q=central`);
  check(stops, { "stops ok": (r) => r.status === 200 });

  sleep(0.5);
}
