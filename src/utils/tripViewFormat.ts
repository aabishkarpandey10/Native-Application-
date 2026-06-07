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

export type DayPart = "early" | "morning" | "midday" | "afternoon" | "evening" | "night";

const DAY_PART_LABELS: Record<DayPart, string> = {
  early: "Early morning (4am–7am)",
  morning: "Morning (7am–10am)",
  midday: "Midday (10am–1pm)",
  afternoon: "Afternoon (1pm–5pm)",
  evening: "Evening (5pm–9pm)",
  night: "Night (9pm–4am)",
};

export function dayPartFromDate(date: Date): DayPart {
  const h = parseInt(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      hour: "numeric",
      hour12: false,
    }).format(date),
    10
  );
  if (h >= 4 && h < 7) return "early";
  if (h >= 7 && h < 10) return "morning";
  if (h >= 10 && h < 13) return "midday";
  if (h >= 13 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function dayPartLabel(part: DayPart): string {
  return DAY_PART_LABELS[part];
}

export const PAST_TRIPS_VISIBLE = 5;

export type TripScheduleSections<T> = {
  sections: { title: string; data: T[] }[];
  /** Scroll anchor: first upcoming trip (section + row). */
  anchor: { sectionIndex: number; itemIndex: number };
  pastShown: number;
  upcomingCount: number;
};

/**
 * Chronological day timeline: last N departed trips, then all upcoming until end of service.
 * Scroll up → earlier (past). Scroll down → later (upcoming).
 */
export function buildTripScheduleSections<T extends { isPast?: boolean; leaveInMinutes?: number }>(
  routes: T[],
  options?: { pastLimit?: number; includePast?: boolean }
): TripScheduleSections<T> {
  const pastLimit = options?.pastLimit ?? PAST_TRIPS_VISIBLE;
  const includePast = options?.includePast !== false;

  const pastAll = routes
    .filter((r) => r.isPast)
    .sort((a, b) => (a.leaveInMinutes ?? 0) - (b.leaveInMinutes ?? 0));
  const recentPast = includePast ? pastAll.slice(-pastLimit) : [];

  const upcoming = routes
    .filter((r) => !r.isPast)
    .sort((a, b) => (a.leaveInMinutes ?? 0) - (b.leaveInMinutes ?? 0));

  const sections: { title: string; data: T[] }[] = [];
  if (recentPast.length > 0) {
    sections.push({ title: "Earlier today", data: recentPast });
  }
  if (upcoming.length > 0) {
    sections.push({ title: "Up next", data: upcoming });
  }

  const upIdx = sections.findIndex((s) => s.title === "Up next");
  return {
    sections,
    anchor: { sectionIndex: upIdx >= 0 ? upIdx : 0, itemIndex: 0 },
    pastShown: recentPast.length,
    upcomingCount: upcoming.length,
  };
}

export function groupItemsByDayPart<T extends { departAt: Date }>(
  items: T[]
): { title: string; part: DayPart; data: T[] }[] {
  const order: DayPart[] = ["early", "morning", "midday", "afternoon", "evening", "night"];
  const buckets = new Map<DayPart, T[]>();
  for (const item of items) {
    const part = dayPartFromDate(item.departAt);
    if (!buckets.has(part)) buckets.set(part, []);
    buckets.get(part)!.push(item);
  }
  return order
    .filter((p) => buckets.has(p))
    .map((part) => ({
      part,
      title: dayPartLabel(part),
      data: buckets.get(part)!,
    }));
}
