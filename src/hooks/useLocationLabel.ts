import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { SYDNEY_STATIONS } from "../constants/stations";

function nearestStationLabel(lat: number, lng: number): string {
  let best = SYDNEY_STATIONS[0];
  let bestDist = Infinity;
  for (const s of SYDNEY_STATIONS) {
    const dlat = s.lat - lat;
    const dlng = s.lon - lng;
    const dist = dlat * dlat + dlng * dlng;
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return `Near ${best.name.replace(/\s+Station$/i, "")}`;
}

/** Human-readable label for the user's coordinates (reverse geocode with station fallback). */
export function useLocationLabel(lat: number, lng: number) {
  const [label, setLabel] = useState("Locating…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (cancelled) return;
        const place = results[0];
        if (place) {
          const parts = [place.name || place.street, place.district || place.subregion, place.city || "Sydney"]
            .filter(Boolean)
            .slice(0, 2);
          if (parts.length > 0) {
            setLabel(parts.join(", "));
            return;
          }
        }
      } catch {
        // fall through to nearest station
      }
      if (!cancelled) setLabel(nearestStationLabel(lat, lng));
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return label;
}
