const TRACKWORK_BLOB =
  /\b(track\s*work|trackwork|planned maintenance|rail maintenance|weekend work|rail repair|buses replace trains?|replacement buses?|replacement bus|changed timetable|rail replacement|station upgrade|line closure|maintenance work)\b/i;

const CRITICAL_BLOB =
  /\b(cancel+ed|suspended|not stopping|major delay|significant delay|signal failure|power failure|emergency|evacuat|avoid travel|no trains|detour|significant delays|service disruption|services suspended)\b/i;

export function isTrackworkAlert(alert) {
  const announcement = String(alert?.announcementType || "").toLowerCase();
  if (announcement === "trackwork") return true;

  const blob = `${alert?.title || ""} ${alert?.description || ""}`;
  return TRACKWORK_BLOB.test(blob);
}

/** Active disruptions — excludes planned trackwork (transportnsw.info "Critical" style). */
export function isCriticalDisruption(alert) {
  if (isTrackworkAlert(alert)) return false;

  if (alert?.severity === "critical") return true;

  const priority = String(alert?.priority || "").toLowerCase();
  const blob = `${alert?.title || ""} ${alert?.description || ""}`;

  if (CRITICAL_BLOB.test(blob)) return true;

  if (priority === "high" || priority === "veryhigh") {
    return !/\b(lift|escalator|info only|good service)\b/i.test(blob);
  }

  return false;
}

export function enrichAlertClassification(alert) {
  return {
    ...alert,
    isTrackwork: isTrackworkAlert(alert),
    isCritical: isCriticalDisruption(alert),
  };
}

export function countByCategory(alerts) {
  let trackwork = 0;
  let critical = 0;
  for (const a of alerts) {
    if (a.isTrackwork) trackwork += 1;
    if (a.isCritical) critical += 1;
  }
  return { trackworkCount: trackwork, criticalCount: critical };
}
