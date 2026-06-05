import http from "k6/http";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 },
    { duration: "5m", target: 500 },
    { duration: "2m", target: 1000 },
    { duration: "3m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(99)<2000"],
    http_req_failed: ["rate<0.1"],
  },
};

const BASE = __ENV.API_URL || "http://localhost:3000";
const STATIONS = ["CENTRAL_T", "TOWNHALL_T", "CIRCULARQUAY_T", "WYNYARD_T", "BONDI_T"];

export default function () {
  const station = STATIONS[Math.floor(Math.random() * STATIONS.length)];
  const res = http.get(`${BASE}/api/departures?stationId=${station}`);
  check(res, { "status 200": (r) => r.status === 200 });
}
