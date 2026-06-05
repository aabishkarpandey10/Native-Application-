/**
 * Install the bundled Sydney rail schematic as the admin-uploaded network map.
 * Usage: node scripts/seed-network-map.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "assets", "images", "sydney-metropolitan-rail-map.png");

if (!existsSync(source)) {
  console.error("Missing:", source);
  process.exit(1);
}

const { saveUploadedNetworkMap } = await import(
  join(root, "backend", "data", "networkMapStore.js")
);
const { getAppConfig } = await import(join(root, "backend", "data", "adminStore.js"));

const buf = readFileSync(source);
const updatedAt = saveUploadedNetworkMap(buf);
const cfg = getAppConfig();

console.log("Network map installed:", {
  bytes: buf.length,
  updatedAt,
  networkMapHasUpload: cfg.networkMapHasUpload,
});
