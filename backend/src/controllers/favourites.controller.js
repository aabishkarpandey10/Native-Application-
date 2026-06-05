import {
  listFavourites,
  addFavouriteStation,
  removeFavouriteStation,
  addFavouriteTrip,
  removeFavouriteTrip,
} from "../services/favourites.service.js";

export function getFavourites(req, res) {
  res.json(listFavourites(req.user.id));
}

export function postFavouriteStation(req, res) {
  const { stationId, stationName, mode } = req.body;
  if (!stationId || !stationName) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "stationId and stationName required" });
  }
  const fav = addFavouriteStation(req.user.id, { stationId, stationName, mode: mode || "train" });
  res.status(201).json(fav);
}

export function deleteFavouriteStation(req, res) {
  const fav = removeFavouriteStation(req.user.id, req.params.stationId);
  res.json(fav);
}

export function postFavouriteTrip(req, res) {
  const { originId, destinationId, alias, mode } = req.body;
  if (!originId || !destinationId) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "originId and destinationId required" });
  }
  const fav = addFavouriteTrip(req.user.id, { originId, destinationId, alias, mode: mode || "train" });
  res.status(201).json(fav);
}

export function deleteFavouriteTrip(req, res) {
  const fav = removeFavouriteTrip(req.user.id, req.params.tripId);
  res.json(fav);
}
