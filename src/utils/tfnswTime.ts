/** Parse & format Transport NSW rapidJSON timestamps (Sydney wall-clock). */

const SYDNEY = "Australia/Sydney";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Offset (ms) of Sydney local wall clock vs UTC at a given UTC instant. */
function getSydneyOffsetMs(utcMs: number): number {
  const date = new Date(utcMs);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const pick = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second")
  );
  return asUtc - utcMs;
}

/** Convert Sydney wall-clock components to a real UTC Date. */
export function sydneyWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = getSydneyOffsetMs(utcGuess);
  return new Date(utcGuess - offset);
}

function parseClockComponents(str: string) {
  const compact = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/);
  if (compact) {
    return {
      year: +compact[1],
      month: +compact[2],
      day: +compact[3],
      hour: +compact[4],
      minute: +compact[5],
      second: +(compact[6] || "0"),
    };
  }
  const iso = str.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (iso) {
    return {
      year: +iso[1],
      month: +iso[2],
      day: +iso[3],
      hour: +iso[4],
      minute: +iso[5],
      second: +(iso[6] || "0"),
    };
  }
  return null;
}

/**
 * Parse TfNSW / app timetable strings. Clock values are always Sydney local
 * (including ISO strings suffixed with Z from TfNSW rapidJSON).
 */
export function parseTfnswTime(value: string | Date | number | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  const str = String(value).trim();
  if (!str) return new Date();

  const parts = parseClockComponents(str.replace(/\.\d+/, "").replace(/Z$/i, ""));
  if (parts) {
    return sydneyWallClockToUtc(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatSydneyTime(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = date instanceof Date ? date : parseTfnswTime(date);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(d);
}

/** 12-hour clock label in Sydney time, e.g. "9:47" (no am/pm). */
export function formatClock(date: string | Date): string {
  return formatSydneyTime(date, { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s*(AM|PM)$/i, "")
    .trim();
}

/** Trip board times with am/pm so afternoon services are not confused with morning. */
export function formatTripClock(date: string | Date): string {
  return formatSydneyTime(date, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .replace(/\s*(AM|PM)$/i, (m) => m.toLowerCase())
    .trim();
}

export function minutesUntil(target: string | Date): number {
  const t = target instanceof Date ? target : parseTfnswTime(target);
  return Math.max(0, Math.round((t.getTime() - Date.now()) / 60000));
}

export function getSydneyItdDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    dateStr: `${pick("year")}${pick("month")}${pick("day")}`,
    timeStr: `${pick("hour")}${pick("minute")}`,
  };
}

/** Serialize a real Date as TfNSW-style Sydney wall-clock ISO (…Z). */
export function toIsoString(date: string | Date): string {
  const d = date instanceof Date ? date : parseTfnswTime(date);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}Z`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}
