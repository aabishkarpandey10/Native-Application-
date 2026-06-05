import crypto from "crypto";

const favouritesByUser = new Map();

function getUserFavourites(userId) {
  if (!favouritesByUser.has(userId)) {
    favouritesByUser.set(userId, { stations: [], trips: [] });
  }
  return favouritesByUser.get(userId);
}

export function listFavourites(userId) {
  return getUserFavourites(userId);
}

export function addFavouriteStation(userId, station) {
  const fav = getUserFavourites(userId);
  if (!fav.stations.some((s) => s.stationId === station.stationId)) {
    fav.stations.push({ ...station, createdAt: new Date().toISOString() });
  }
  return fav;
}

export function removeFavouriteStation(userId, stationId) {
  const fav = getUserFavourites(userId);
  fav.stations = fav.stations.filter((s) => s.stationId !== stationId);
  return fav;
}

export function addFavouriteTrip(userId, trip) {
  const fav = getUserFavourites(userId);
  const exists = fav.trips.some(
    (t) => t.originId === trip.originId && t.destinationId === trip.destinationId
  );
  if (!exists) {
    fav.trips.push({ id: crypto.randomUUID(), ...trip, createdAt: new Date().toISOString() });
  }
  return fav;
}

export function removeFavouriteTrip(userId, tripId) {
  const fav = getUserFavourites(userId);
  fav.trips = fav.trips.filter((t) => t.id !== tripId);
  return fav;
}
