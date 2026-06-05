/** Legacy / schematic map IDs → canonical network station IDs */
export const STATION_ALIASES = {
  CENTRAL: "CENTRAL_T",
  WYNYARD: "WYNYARD_T",
  TOWNHALL: "TOWNHALL_T",
  STJAMES: "STJAMES_T",
  MUSEUM: "MUSEUM_T",
  REDFERN: "REDFERN_T",
  CQ: "CIRCULARQUAY_T",
  CIRCULAR_QUAY: "CIRCULARQUAY_T",
};

export function normalizeStationId(stationId) {
  if (!stationId || typeof stationId !== "string") return stationId;
  const trimmed = stationId.trim();
  return STATION_ALIASES[trimmed] || STATION_ALIASES[trimmed.toUpperCase()] || trimmed;
}
