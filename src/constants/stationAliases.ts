/** Legacy schematic map IDs → canonical network station IDs */
const ALIASES: Record<string, string> = {
  CENTRAL: "CENTRAL_T",
  WYNYARD: "WYNYARD_T",
  TOWNHALL: "TOWNHALL_T",
  STJAMES: "STJAMES_T",
  MUSEUM: "MUSEUM_T",
  REDFERN: "REDFERN_T",
  CQ: "CIRCULARQUAY_T",
  CIRCULAR_QUAY: "CIRCULARQUAY_T",
};

export function normalizeStationId(stationId: string | null | undefined): string {
  if (!stationId) return "";
  const trimmed = stationId.trim();
  return ALIASES[trimmed] || ALIASES[trimmed.toUpperCase()] || trimmed;
}
