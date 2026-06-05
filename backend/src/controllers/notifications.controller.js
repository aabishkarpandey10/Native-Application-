import {
  registerPushToken,
  unregisterPushToken,
  getTokensForUser,
} from "../services/notifications.service.js";

export async function register(req, res, next) {
  try {
    const { expoPushToken, commuteAlertsEnabled, subscribedRoutes } = req.body;
    const record = registerPushToken(req.user.id, {
      expoPushToken,
      commuteAlertsEnabled,
      subscribedRoutes,
    });
    res.status(201).json({ notification: record });
  } catch (err) {
    next(err);
  }
}

export async function unregister(req, res, next) {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "expoPushToken required" });
    }
    unregisterPushToken(req.user.id, expoPushToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function list(req, res) {
  res.json({ tokens: getTokensForUser(req.user.id) });
}
