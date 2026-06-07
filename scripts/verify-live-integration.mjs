#!/usr/bin/env node
/**
 * Verifies live backend integration — health, departures, alerts, nearby.
 * Usage: node scripts/verify-live-integration.mjs [API_BASE_URL]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envPath = join(root, ".env");

function readEnvUrl() {
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) {
    return process.env.EXPO_PUBLIC_API_URL.trim().replace(/\/$/, "");
  }
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, "utf8").match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
    if (match) return match[1].trim().replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

const base = (process.argv[2] || readEnvUrl()).replace(/\/$/, "");
const MOCK_SOURCES = new Set(["mock", "mock-fallback"]);

const checks = [];
const failures = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  failures.push({ name, detail });
  checks.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(path, opts = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, url, body };
}

console.log("\n=== Sydney Transit — Live Backend Verification ===\n");
console.log("Backend URL:", base);
console.log("Node env vars:");
console.log("  EXPO_PUBLIC_API_URL =", process.env.EXPO_PUBLIC_API_URL ?? "(not set)");
console.log("  ALLOW_MOCK_DATA =", process.env.ALLOW_MOCK_DATA ?? "(not set → false on server)");
console.log("  API_REQUEST_LOG =", process.env.API_REQUEST_LOG ?? "(not set)");
console.log("");

// HTTPS / cloud guidance
if (/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./i.test(base)) {
  fail(
    "Cloud readiness",
    "API URL is local/private — EAS cloud builds need a public HTTPS EXPO_PUBLIC_API_URL"
  );
} else if (base.startsWith("http://")) {
  fail("HTTPS", "Release Android/iOS require HTTPS for production API URLs");
} else if (base.startsWith("https://")) {
  pass("HTTPS", "Production URL uses TLS");
}

try {
  const health = await fetchJson("/api/health");
  let healthOk = health.ok && health.body?.ok;

  if (healthOk) {
    pass("GET /api/health", `status=${health.body.status}, tfnswLive=${health.body.tfnswLive}`);
    if (health.body.allowMockData) {
      fail("ALLOW_MOCK_DATA", "Server has demo data enabled — set ALLOW_MOCK_DATA=false in production");
    } else {
      pass("ALLOW_MOCK_DATA", "Demo data disabled on server");
    }
    if (health.body.dataSource === "mock") {
      fail("dataSource", "Health reports mock data source");
    }
  } else if (health.status === 404) {
    const legacy = await fetchJson("/api/status");
    if (legacy.ok && legacy.body?.ok) {
      pass("GET /api/health", "not deployed — /api/status OK (restart backend for /api/health)");
      healthOk = true;
    } else {
      fail("GET /api/health", `HTTP ${health.status}`);
    }
  } else {
    fail("GET /api/health", `HTTP ${health.status}`);
  }
} catch (err) {
  fail("GET /api/health", err.message);
}

try {
  const legacy = await fetchJson("/api/status");
  if (legacy.ok && legacy.body?.ok) pass("GET /api/status", "legacy alias OK");
  else fail("GET /api/status", `HTTP ${legacy.status}`);
} catch (err) {
  fail("GET /api/status", err.message);
}

try {
  const dep = await fetchJson("/api/departures?stationId=CENTRAL_T");
  if (!dep.ok) {
    fail("GET /api/departures", `HTTP ${dep.status}`);
  } else {
    const source = dep.body?.source;
    const count = Array.isArray(dep.body?.departures) ? dep.body.departures.length : 0;
    if (MOCK_SOURCES.has(source)) {
      fail("Departures source", `mock payload (${source}) — configure TFNSW_API_KEY`);
    } else {
      pass("GET /api/departures", `source=${source}, count=${count}`);
    }
  }
} catch (err) {
  fail("GET /api/departures", err.message);
}

try {
  const alerts = await fetchJson("/api/alerts");
  if (!alerts.ok) {
    fail("GET /api/alerts", `HTTP ${alerts.status}`);
  } else {
    const count = Array.isArray(alerts.body?.alerts)
      ? alerts.body.alerts.length
      : Array.isArray(alerts.body)
        ? alerts.body.length
        : 0;
    pass("GET /api/alerts", `count=${count}, source=${alerts.body?.source ?? "legacy"}`);
  }
} catch (err) {
  fail("GET /api/alerts", err.message);
}

try {
  const nearby = await fetchJson("/api/nearby?lat=-33.8688&lng=151.2093&radius=1500");
  if (!nearby.ok) {
    fail("GET /api/nearby", `HTTP ${nearby.status}`);
  } else {
    const count = Array.isArray(nearby.body) ? nearby.body.length : 0;
    pass("GET /api/nearby", `${count} stops`);
  }
} catch (err) {
  fail("GET /api/nearby", err.message);
}

try {
  const trip = await fetchJson(
    "/api/trip?originId=CENTRAL_T&destinationId=TOWNHALL_T",
    { timeoutMs: 45_000 }
  );
  if (!trip.ok) {
    fail("GET /api/trip", `HTTP ${trip.status}`);
  } else {
    const list = Array.isArray(trip.body) ? trip.body : [];
    const mockTrip = list.some((j) => String(j?.id ?? "").startsWith("mock_trip_"));
    if (mockTrip) {
      fail("Trip planner", "Returned mock_trip_* itineraries");
    } else {
      pass("GET /api/trip", `${list.length} itineraries`);
    }
  }
} catch (err) {
  fail("GET /api/trip", err.message);
}

console.log("\n=== Summary ===");
console.log(`Passed: ${checks.filter((c) => c.ok).length}/${checks.length}`);
if (failures.length) {
  console.log("\nFailed checks:");
  for (const f of failures) {
    console.log(`  • ${f.name}: ${f.detail}`);
  }
  process.exit(1);
}

console.log("\nAll checks passed. Cloud build checklist:");
console.log("  1. Deploy backend with TFNSW_API_KEY and ALLOW_MOCK_DATA=false");
console.log("  2. eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://YOUR-API");
console.log("  3. npx eas-cli build -p android --profile production");
console.log("  4. Set EXPO_PUBLIC_API_DEBUG=true on preview builds to log API traffic in Metro/device logs\n");
