import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { setAppConfig } from "./adminStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, "uploads");
const LOGO_FILE = join(UPLOAD_DIR, "app-logo.png");

export function hasUploadedAppLogo() {
  return existsSync(LOGO_FILE);
}

export function readUploadedAppLogo() {
  if (!existsSync(LOGO_FILE)) return null;
  return readFileSync(LOGO_FILE);
}

export function getUploadedAppLogoContentType() {
  const buf = readUploadedAppLogo();
  if (!buf || buf.length < 4) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/png";
}

export function saveUploadedAppLogo(buffer) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(LOGO_FILE, buffer);
  const updatedAt = new Date().toISOString();
  setAppConfig({ appLogoUpdatedAt: updatedAt, appLogoUrl: "" });
  return updatedAt;
}

export function clearUploadedAppLogo() {
  if (existsSync(LOGO_FILE)) {
    try {
      unlinkSync(LOGO_FILE);
    } catch {
      /* ignore */
    }
  }
  setAppConfig({ appLogoUpdatedAt: null });
}

