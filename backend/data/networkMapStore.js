import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getAppConfig, setAppConfig } from "./adminStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, "uploads");
const MAP_FILE = join(UPLOAD_DIR, "network-map.png");

export function hasUploadedNetworkMap() {
  return existsSync(MAP_FILE);
}

export function readUploadedNetworkMap() {
  if (!existsSync(MAP_FILE)) return null;
  return readFileSync(MAP_FILE);
}

export function getUploadedNetworkMapContentType() {
  const buf = readUploadedNetworkMap();
  if (!buf || buf.length < 4) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/png";
}

export function saveUploadedNetworkMap(buffer) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(MAP_FILE, buffer);
  const updatedAt = new Date().toISOString();
  setAppConfig({ networkMapUpdatedAt: updatedAt, networkMapUrl: "" });
  return updatedAt;
}

export function clearUploadedNetworkMap() {
  if (existsSync(MAP_FILE)) {
    try {
      unlinkSync(MAP_FILE);
    } catch {
      /* ignore */
    }
  }
  setAppConfig({ networkMapUpdatedAt: null });
}

export function resolveNetworkMapSource(config = getAppConfig()) {
  if (hasUploadedNetworkMap()) {
    return {
      type: "upload",
      updatedAt: config.networkMapUpdatedAt ?? "upload",
    };
  }
  const url = String(config.networkMapUrl ?? "").trim();
  if (url) {
    return { type: "url", url };
  }
  return { type: "default" };
}

