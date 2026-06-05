/** TripView-style countdown labels (Now, 15 mins, 5 hrs, 12m ago). */
export function formatLeaveIn(minutes: number): string {
  if (minutes < 0) {
    const ago = Math.abs(minutes);
    if (ago < 60) return `${ago}m ago`;
    const hrs = Math.floor(ago / 60);
    const rem = ago % 60;
    if (rem === 0) return `${hrs}h ago`;
    return `${hrs}h ${rem}m ago`;
  }
  if (minutes <= 0) return "Now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"}`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr${hrs > 1 ? "s" : ""} ${rem}m`;
}

export function shortStationName(name: string): string {
  return name.replace(/\s+Station$/i, "").trim();
}
