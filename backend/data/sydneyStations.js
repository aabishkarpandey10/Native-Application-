import { getCoreStations, getStationById } from "./stationRegistry.js";
import { SYDNEY_BUS_STOPS } from "./busNetworkData.js";
import { SYDNEY_LIGHT_RAIL_STOPS } from "./lightRailNetworkData.js";
import { SYDNEY_METRO_STATIONS } from "./metroNetworkData.js";

/** Core network only (train, metro, light rail, ferry). Bus stops use /api/stations?mode=bus. */
export const SYDNEY_STATIONS = getCoreStations();

export { getStationById };

export const STATION_ID_MAP = Object.fromEntries([
  ...SYDNEY_STATIONS.filter((s) => s.tfnswStopId).map((s) => [s.id, s.tfnswStopId]),
  ...SYDNEY_BUS_STOPS.filter((s) => s.tfnswStopId).map((s) => [s.id, s.tfnswStopId]),
  ...SYDNEY_LIGHT_RAIL_STOPS.filter((s) => s.tfnswStopId).map((s) => [s.id, s.tfnswStopId]),
  ...SYDNEY_METRO_STATIONS.filter((s) => s.tfnswStopId).map((s) => [s.id, s.tfnswStopId]),
]);
