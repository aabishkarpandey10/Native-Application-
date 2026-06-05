const tokens = new Map();

export function registerPushToken(userId, { expoPushToken, commuteAlertsEnabled = true, subscribedRoutes = [] }) {
  if (!expoPushToken) throw Object.assign(new Error("expoPushToken required"), { status: 400, code: "VALIDATION_ERROR" });
  const key = `${userId}:${expoPushToken}`;
  tokens.set(key, {
    userId,
    expoPushToken,
    commuteAlertsEnabled,
    subscribedRoutes,
    registeredAt: new Date().toISOString(),
  });
  return tokens.get(key);
}

export function unregisterPushToken(userId, expoPushToken) {
  tokens.delete(`${userId}:${expoPushToken}`);
}

export function getTokensForUser(userId) {
  return [...tokens.values()].filter((t) => t.userId === userId);
}

export function getTokensForRoute(routeId) {
  return [...tokens.values()].filter(
    (t) => t.commuteAlertsEnabled && (t.subscribedRoutes.length === 0 || t.subscribedRoutes.includes(routeId))
  );
}

export async function sendExpoPush(messages) {
  if (!messages.length) return { sent: 0 };
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    console.warn("[Push] Expo API error:", response.status);
    return { sent: 0, error: response.status };
  }
  const data = await response.json();
  return { sent: messages.length, receipts: data.data };
}

export async function broadcastAlertPush(alert) {
  const affected = alert.affectedLines || alert.affected_lines || [];
  const recipients = new Set();
  for (const route of affected) {
    for (const t of getTokensForRoute(route)) {
      recipients.add(t.expoPushToken);
    }
  }
  const messages = [...recipients].map((token) => ({
    to: token,
    title: alert.title || "Service Alert",
    body: alert.description || "Check TripView for details",
    data: { alertId: alert.id, type: "service_alert" },
    sound: "default",
    priority: "high",
  }));
  return sendExpoPush(messages);
}
