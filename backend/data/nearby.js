export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function rankNearbyStations(stations, lat, lng, radiusMeters, limit = 15) {
  return stations
    .map((s) => ({
      station_id: s.id,
      station_name: s.name,
      latitude: s.lat,
      longitude: s.lon,
      transit_mode: s.mode === "lightrail" ? "light_rail" : s.mode,
      distance_meters: Math.round(haversineMeters(lat, lng, s.lat, s.lon)),
    }))
    .filter((s) => s.distance_meters <= radiusMeters)
    .sort((a, b) => a.distance_meters - b.distance_meters)
    .slice(0, limit);
}
