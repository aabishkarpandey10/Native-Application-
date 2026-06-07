import express from "express";
import { join } from "path";
import {
  getAppData,
  getAppConfig,
  getStations,
  getAlerts,
  setAppConfig,
  setStations,
  setAlerts,
  resetAppData,
} from "./data/adminStore.js";
import { normalizeAppConfig } from "./data/appConfigDefaults.js";
import { clearAlertsCache } from "./data/alertsService.js";
import { invalidateStationCaches } from "./data/stationRegistry.js";
import { clearDeparturesCache } from "./src/services/cache.service.js";
import {
  clearUploadedNetworkMap,
  getUploadedNetworkMapContentType,
  readUploadedNetworkMap,
  saveUploadedNetworkMap,
} from "./data/networkMapStore.js";
import {
  clearUploadedAppLogo,
  getUploadedAppLogoContentType,
  readUploadedAppLogo,
  saveUploadedAppLogo,
} from "./data/appLogoStore.js";

function getAdminToken() {
  return (process.env.ADMIN_TOKEN || "sydney-transit-admin-dev").trim();
}

function getAdminPassword() {
  return (process.env.ADMIN_PASSWORD || "admin123").trim();
}

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-admin-token"];
  if (token && token === getAdminToken()) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

export function registerAdminRoutes(app, { __dirname: adminDir }) {
  const adminPath = join(adminDir, "admin");
  app.use("/admin", express.static(adminPath));

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body || {};
    if (password === getAdminPassword()) {
      return res.json({ token: getAdminToken(), ok: true });
    }
    return res.status(401).json({ error: "Invalid password" });
  });

  app.get("/api/admin/me", requireAdmin, (_req, res) => {
    res.json({ ok: true, role: "admin" });
  });

  app.get("/api/admin/data", requireAdmin, (_req, res) => {
    const data = getAppData();
    res.json({
      ...data,
      appConfig: normalizeAppConfig(data.appConfig),
      stations: getStations(),
    });
  });

  app.post("/api/admin/reset", requireAdmin, (_req, res) => {
    invalidateStationCaches();
    res.json(resetAppData());
  });

  app.get("/api/admin/app-config", requireAdmin, (_req, res) => {
    res.json(getAppConfig());
  });

  app.put("/api/admin/app-config", requireAdmin, async (req, res) => {
    await clearDeparturesCache();
    clearAlertsCache();
    res.json(setAppConfig(req.body || {}));
  });

  app.get("/api/admin/stations", requireAdmin, (_req, res) => {
    res.json(getStations());
  });

  app.put("/api/admin/stations", requireAdmin, async (req, res) => {
    const list = Array.isArray(req.body) ? req.body : req.body.stations;
    if (!Array.isArray(list)) return res.status(400).json({ error: "Expected stations array" });
    await clearDeparturesCache();
    invalidateStationCaches();
    res.json(setStations(list));
  });

  app.post("/api/admin/stations", requireAdmin, async (req, res) => {
    const station = req.body;
    if (!station?.id || !station?.name) {
      return res.status(400).json({ error: "id and name required" });
    }
    const list = getStations().filter((s) => s.id !== station.id);
    list.push({ disabled: false, ...station });
    await clearDeparturesCache();
    invalidateStationCaches();
    res.status(201).json(setStations(list));
  });

  app.delete("/api/admin/stations/:id", requireAdmin, async (req, res) => {
    const id = req.params.id;
    const list = getStations().map((s) =>
      s.id === id ? { ...s, disabled: true } : s
    );
    await clearDeparturesCache(id);
    invalidateStationCaches();
    res.json(setStations(list));
  });

  app.get("/api/admin/alerts", requireAdmin, (_req, res) => {
    res.json(getAlerts());
  });

  app.put("/api/admin/alerts", requireAdmin, (req, res) => {
    const list = Array.isArray(req.body) ? req.body : req.body.alerts;
    if (!Array.isArray(list)) return res.status(400).json({ error: "Expected alerts array" });
    clearAlertsCache();
    res.json(setAlerts(list));
  });

  app.post("/api/admin/alerts", requireAdmin, (req, res) => {
    const alert = req.body;
    if (!alert?.id || !alert?.title) {
      return res.status(400).json({ error: "id and title required" });
    }
    const list = getAlerts().filter((a) => a.id !== alert.id);
    list.unshift({
      updatedAt: new Date().toISOString(),
      ...alert,
    });
    clearAlertsCache();
    res.status(201).json(setAlerts(list));
  });

  app.delete("/api/admin/alerts/:id", requireAdmin, (req, res) => {
    const list = getAlerts().filter((a) => a.id !== req.params.id);
    clearAlertsCache();
    res.json(setAlerts(list));
  });

  app.get("/api/network-map", (_req, res) => {
    const buf = readUploadedNetworkMap();
    if (!buf) {
      return res.status(404).json({ error: "No custom network map uploaded" });
    }
    res.setHeader("Content-Type", getUploadedNetworkMapContentType());
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(buf);
  });

  app.get("/api/app-logo", (_req, res) => {
    const buf = readUploadedAppLogo();
    if (!buf) {
      return res.status(404).json({ error: "No custom app logo uploaded" });
    }
    res.setHeader("Content-Type", getUploadedAppLogoContentType());
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(buf);
  });

  app.post(
    "/api/admin/network-map",
    requireAdmin,
    express.json({ limit: "25mb" }),
    (req, res) => {
      const raw = req.body?.imageBase64 ?? req.body?.data;
      if (!raw || typeof raw !== "string") {
        return res.status(400).json({ error: "imageBase64 required" });
      }
      const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
      let buffer;
      try {
        buffer = Buffer.from(base64, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid image data" });
      }
      if (buffer.length < 100) {
        return res.status(400).json({ error: "Image file too small" });
      }
      if (buffer.length > 20 * 1024 * 1024) {
        return res.status(400).json({ error: "Image must be under 20MB" });
      }
      const updatedAt = saveUploadedNetworkMap(buffer);
      res.json({ ok: true, networkMapUpdatedAt: updatedAt });
    }
  );

  app.delete("/api/admin/network-map", requireAdmin, (_req, res) => {
    clearUploadedNetworkMap();
    res.json({ ok: true, networkMapUpdatedAt: null });
  });

  app.post(
    "/api/admin/app-logo",
    requireAdmin,
    express.json({ limit: "25mb" }),
    (req, res) => {
      const raw = req.body?.imageBase64 ?? req.body?.data;
      if (!raw || typeof raw !== "string") {
        return res.status(400).json({ error: "imageBase64 required" });
      }
      const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
      let buffer;
      try {
        buffer = Buffer.from(base64, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid image data" });
      }
      if (buffer.length < 100) {
        return res.status(400).json({ error: "Image file too small" });
      }
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: "Image must be under 10MB" });
      }
      const updatedAt = saveUploadedAppLogo(buffer);
      res.json({ ok: true, appLogoUpdatedAt: updatedAt });
    }
  );

  app.delete("/api/admin/app-logo", requireAdmin, (_req, res) => {
    clearUploadedAppLogo();
    res.json({ ok: true, appLogoUpdatedAt: null });
  });
}
