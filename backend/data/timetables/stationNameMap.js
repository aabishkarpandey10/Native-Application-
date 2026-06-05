import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SYDNEY_STATIONS } from "../sydneyStations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Manual aliases used in Transport NSW PDF timetables. */
const PDF_ALIASES = {
  "Bondi Junction": "BONDI_T",
  "Domestic Airport": "AIRPORT_DOM_T",
  "International Airport": "AIRPORT_INT_T",
  Domestic: "AIRPORT_DOM_T",
  International: "AIRPORT_INT_T",
  "Olympic Park": "OLYMPIC_PARK_T",
  "Parramatta DEP": "PARRAMATTA_T",
  "Parramatta ARR": "PARRAMATTA_T",
  Parramatta: "PARRAMATTA_T",
  "Harris Park": "GRANVILLE_T",
  "St Marys": "ST_MARYS_T",
  "St Mary": "ST_MARYS_T",
  "St Leonards": "STLEONARDS_T",
  "Milsons Point": "MILSONS_POINT_T",
  "North Sydney": "NORTHSYDNEY_T",
  "Kings Cross": "KINGS_CROSS_T",
  "Green Square": "GREEN_SQUARE_T",
  "Wolli Creek": "WOLLI_CREEK_T",
  "Mount Druitt": "MOUNT_DRUITT_T",
  "Emu Plains": "EMU_PLAINS_T",
  "Newcastle Interchange": "NEWCASTLE_T",
  Sydenham: "SYDENHAM_M",
  "Capitol Square": "CAPITOLSQUARELIGHTRAIL_LR",
  Capitol: "CAPITOLSQUARELIGHTRAIL_LR",
  "Paddy's Markets": "PADDYSMARKETSLIGHTRAIL_LR",
  "Paddys Markets": "PADDYSMARKETSLIGHTRAIL_LR",
  "Paddy's": "PADDYSMARKETSLIGHTRAIL_LR",
  Paddys: "PADDYSMARKETSLIGHTRAIL_LR",
  "Bank Street": "BANKSTREETLIGHTRAIL_LR",
  "Bank Street, Pyrmont": "BANKSTREETLIGHTRAIL_LR",
  "Exhibition Centre": "EXHIBITION_LR",
  "Convention Centre": "CONVENTION_LR",
  "Pyrmont Bay": "PYRMONTBAY_LR",
  "The Star": "THESTAR_LR",
  "John Street Square": "JOHNSTREET_LR",
  "Wentworth Park": "WENTWORTHPARK_LR",
  "Jubilee Park": "JUBILEEPARK_LR",
  "Rozelle Bay": "ROZELLEBAY_LR",
  "Leichhardt North": "LEICHHARDTNORTH_LR",
  "Lewisham West": "LEWISHAMWEST_LR",
  "Waratah Mills": "WARATAHMILLS_LR",
  "Dulwich Grove": "DULWICHGROVE_LR",
  "Dulwich Hill": "DULWICHHILL_LR",
  "ES Marks": "ESMARKS_LR",
  "Moore Park": "MOOREPARK_LR",
  "Royal Randwick": "ROYALRANDWICK_LR",
  "Wansey Road": "WANSEYROAD_LR",
  "UNSW High Street": "UNSWHIGHSTREET_LR",
  "UNSW Anzac Parade": "UNSWANZAC_LR",
  "Juniors Kingsford": "JUNIORSKINGSFORD_LR",
  "Surry Hills": "SURRYHILLS_LR",
  "Bridge Street": "BRIDGESTREET_LR",
  "Circular Quay": "CIRCULARQUAY_LR",
  "Town Hall": "TOWNHALL_LR",
  Wynyard: "WYNYARD_LR",
  QVB: "QVB_LR",
  Chinatown: "CHINATOWN_LR",
  Haymarket: "HAYMARKET_LR",
  Central: "CENTRAL_LR",
  Randwick: "RANDWICK_LR",
  Kingsford: "KINGSFORD_LR",
  Kensington: "KENSINGTON_LR",
};

function cleanLabel(label) {
  const base = String(label || "")
    .split(",")[0]
    .replace(/\s+Station$/i, "")
    .replace(/\s+Wharf.*$/i, "")
    .replace(/\s+Metro$/i, "")
    .replace(/\s+Light\s+Rail$/i, "")
    .trim();
  return base;
}

/** Build PDF station label → app station id map. */
export function buildStationNameMap() {
  /** @type {Record<string, string>} */
  const map = { ...PDF_ALIASES };

  const appDataPath = path.join(__dirname, "..", "app-data.json");
  let appStations = [];
  try {
    appStations = JSON.parse(readFileSync(appDataPath, "utf8")).stations || [];
  } catch {
    // optional
  }

  for (const s of [...SYDNEY_STATIONS, ...appStations]) {
    if (!s?.id || !s?.name) continue;
    map[cleanLabel(s.name)] = s.id;
    map[s.name] = s.id;
    if (s.code) map[s.code] = s.id;
  }

  return map;
}

export const CBD_STATION_IDS = new Set([
  "CENTRAL_T",
  "TOWNHALL_T",
  "WYNYARD_T",
  "MARTINPLACE_T",
  "STJAMES_T",
  "MUSEUM_T",
  "CIRCULARQUAY_T",
  "REDFERN_T",
]);
