import type { Station } from "./stations";

/** Extra stops for line browsers (light rail & bus corridors). */
export const NETWORK_EXTRA_STATIONS: Station[] = [
  // Light rail L1 — Dulwich Hill line (east → west)
  { id: "EXHIBITION_LR", name: "Exhibition Centre", lat: -33.877, lon: 151.198, mode: "lightrail" },
  { id: "PYRMONT_LR", name: "Pyrmont Bay", lat: -33.871, lon: 151.196, mode: "lightrail" },
  { id: "FISHMARKET_LR", name: "Fish Market", lat: -33.874, lon: 151.192, mode: "lightrail" },
  { id: "GLEBE_LR", name: "Glebe", lat: -33.879, lon: 151.185, mode: "lightrail" },
  { id: "LILYFIELD_LR", name: "Lilyfield", lat: -33.873, lon: 151.163, mode: "lightrail" },
  { id: "LEICHHARDT_LR", name: "Leichhardt North", lat: -33.877, lon: 151.155, mode: "lightrail" },
  { id: "DULWICH_LR", name: "Dulwich Hill", lat: -33.905, lon: 151.138, mode: "lightrail" },
  // Light rail L2 — CBD & southeast
  { id: "QVB_LR", name: "QVB", lat: -33.872, lon: 151.207, mode: "lightrail" },
  { id: "TOWNHALL_LR", name: "Town Hall", lat: -33.873, lon: 151.206, mode: "lightrail" },
  { id: "HAYMARKET_LR", name: "Haymarket", lat: -33.88, lon: 151.204, mode: "lightrail" },
  { id: "MOOREPARK_LR", name: "Moore Park", lat: -33.895, lon: 151.218, mode: "lightrail" },
  { id: "UNSW_LR", name: "UNSW High Street", lat: -33.917, lon: 151.231, mode: "lightrail" },
  { id: "ANZAC_LR", name: "Anzac Parade", lat: -33.924, lon: 151.238, mode: "lightrail" },
  // Bus B-Line (north → south)
  { id: "NARRABEEN_BUS", name: "Narrabeen B-Line", lat: -33.714, lon: 151.298, mode: "bus" },
  { id: "DEEWHY_BUS", name: "Dee Why B-Line", lat: -33.754, lon: 151.289, mode: "bus" },
  { id: "BROOKVALE_BUS", name: "Brookvale B-Line", lat: -33.768, lon: 151.271, mode: "bus" },
  { id: "SPIT_BUS", name: "Spit Junction B-Line", lat: -33.824, lon: 151.242, mode: "bus" },
  { id: "NEUTRALBAY_BUS", name: "Neutral Bay B-Line", lat: -33.832, lon: 151.218, mode: "bus" },
  { id: "WYNYARD_BUS", name: "Wynyard B-Line", lat: -33.866, lon: 151.206, mode: "bus" },
  // Bus 333 corridor
  { id: "HYDEPARK_BUS", name: "Hyde Park", lat: -33.875, lon: 151.212, mode: "bus" },
  { id: "STJAMES_BUS", name: "St James", lat: -33.87, lon: 151.21, mode: "bus" },
  { id: "OXFORD_BUS", name: "Oxford Street", lat: -33.884, lon: 151.218, mode: "bus" },
  { id: "BONDI_BEACH_BUS", name: "Bondi Beach", lat: -33.891, lon: 151.274, mode: "bus" },
];
