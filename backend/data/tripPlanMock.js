import { getLinesForStation } from "./sydneyNetworks.js";
import { findBranchPath } from "./trainNetworkPath.js";
import { buildLineStopSequence } from "./stopSequence.js";
import { toIsoString } from "./tfnswTime.js";

export function buildMockTripItineraries(origin, dest, departDate) {
  const itineraries = [];
  const minutesPerStopForMode = (mode) => {
    if (mode === "ferry") return 5;
    if (mode === "metro") return 3;
    if (mode === "bus") return 4;
    if (mode === "lightrail" || mode === "light_rail") return 4;
    return 3;
  };

  const estimateFallbackDuration = (origSt, destSt, mode) => {
    const lat1 = origSt.lat ?? origSt.latitude ?? -33.87;
    const lon1 = origSt.lon ?? origSt.longitude ?? 151.21;
    const lat2 = destSt.lat ?? destSt.latitude ?? -33.87;
    const lon2 = destSt.lon ?? destSt.longitude ?? 151.21;
    const R = 6371e3;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const kmh = mode === "ferry" ? 25 : mode === "bus" ? 28 : 45;
    return Math.max(6, Math.round((meters / 1000 / kmh) * 60));
  };

  for (let i = 0; i < 6; i++) {
    const departureTime = new Date(departDate.getTime() + (5 + i * 12) * 60000);
    const directTrainPath =
      origin.mode === "train" ? findBranchPath(origin.id, dest.id, null) : null;
    const linesForOrigin =
      origin.mode === "train" || origin.mode === "metro"
        ? getLinesForStation(origin.id)
        : [];
    const routeNo =
      directTrainPath?.route ||
      linesForOrigin[i % Math.max(linesForOrigin.length, 1)] ||
      (origin.mode === "metro"
        ? "M1"
        : origin.mode === "train"
          ? "T2"
          : origin.mode === "lightrail"
            ? "L2"
            : "T2");
    const perStop = minutesPerStopForMode(origin.mode);
    const useLineSequence =
      origin.mode === "train" ||
      origin.mode === "metro" ||
      origin.mode === "lightrail";
    const lineStops = useLineSequence
      ? buildLineStopSequence({
          originStationId: origin.id,
          destinationLabel: dest.name.replace(/ Station$/, ""),
          lineRoute: routeNo,
          schedTime: departureTime,
          minutesPerStop: perStop,
        })
      : [];
    const stopNames =
      lineStops.length >= 2 ? lineStops.map((s) => s.station_name) : [origin.name, dest.name];
    const duration =
      lineStops.length >= 2
        ? (lineStops.length - 1) * perStop
        : estimateFallbackDuration(origin, dest, origin.mode);
    const arrivalTime = new Date(departureTime.getTime() + duration * 60000);

    itineraries.push({
      id: `mock_trip_${i}_${origin.id}_${dest.id}`,
      totalDurationMinutes: duration,
      departureTime: toIsoString(departureTime),
      arrivalTime: toIsoString(arrivalTime),
      legs: [
        {
          mode: origin.mode === "lightrail" ? "light_rail" : origin.mode,
          originName: origin.name,
          destinationName: dest.name,
          originId: origin.id,
          destinationId: dest.id,
          departureTime: toIsoString(departureTime),
          arrivalTime: toIsoString(arrivalTime),
          durationMinutes: duration,
          platform: `Platform ${(i % 6) + 1}`,
          routeNumber: routeNo,
          stops: stopNames,
        },
      ],
      transfersCount: 0,
    });
  }
  return itineraries;
}
