/**
 * Copy backend train network → frontend constants.
 * Run after sync:train-network-gtfs: npm run sync:train-network
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  GREATER_SYDNEY_TRAIN_STATIONS,
  TRAIN_LINE_BRANCHES,
  LINE_STATION_IDS,
} from "../backend/data/trainNetworkData.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src", "constants", "generated");
mkdirSync(outDir, { recursive: true });

const payload = {
  stations: GREATER_SYDNEY_TRAIN_STATIONS.map((s) => ({ ...s, mode: "train" })),
  branches: TRAIN_LINE_BRANCHES,
  lineStationIds: LINE_STATION_IDS,
};

writeFileSync(join(outDir, "trainNetwork.json"), JSON.stringify(payload, null, 2));
console.log(
  `Wrote ${payload.stations.length} train stations, ${payload.branches.length} line branches → src/constants/generated/trainNetwork.json`
);
