/** Parse & format Transport NSW rapidJSON timestamps (Sydney wall-clock). */

const SYDNEY = "Australia/Sydney";

function getSydneyOffsetMs(utcMs) {
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
  const pick = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
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

export function sydneyWallClockToUtc(year, month, day, hour, minute, second = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(utcGuess - getSydneyOffsetMs(utcGuess));
}

function parseClockComponents(str) {
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
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
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

export function parseTfnswTime(value) {
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

/**
 * Parse a RAW Transport NSW API timestamp, which is genuine UTC (e.g.
 * "2026-05-30T07:55:00Z" = 17:55 Sydney). Unlike parseTfnswTime, this does NOT
 * treat the clock as Sydney wall-time — it returns the true instant. Pair with
 * toIsoString() to emit the internal Sydney-wall-clock wire format.
 */
export function parseApiTime(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  const str = String(value).trim();
  if (!str) return new Date();

  // ISO string carrying a timezone (Z or ±HH:MM) → native parse is correct UTC.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // Compact YYYYMMDDHHmmss from TfNSW rapidJSON is expressed in UTC.
  const compact = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/);
  if (compact) {
    return new Date(
      Date.UTC(
        +compact[1],
        +compact[2] - 1,
        +compact[3],
        +compact[4],
        +compact[5],
        +(compact[6] || 0)
      )
    );
  }

  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function formatSydneyTime(date, options = {}) {
  const d = date instanceof Date ? date : parseTfnswTime(date);
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(d);
}

export function minutesUntil(target) {
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
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    dateStr: `${pick("year")}${pick("month")}${pick("day")}`,
    timeStr: `${pick("hour")}${pick("minute")}`,
  };
}

export function toIsoString(date) {
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
  const pick = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}Z`;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function getSydneyWeekdayShort(date = new Date()) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    weekday: "short",
  }).format(date);
}

export function isSydneyWeekend(date = new Date()) {
  const day = getSydneyWeekdayShort(date);
  return day === "Sat" || day === "Sun";
}

function sydneyDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** 4:00 Sydney — start of the "service day" for full-day timetables. */
export function sydneyServiceDayStart(ref = new Date()) {
  const parts = sydneyDateParts(ref);
  let start = sydneyWallClockToUtc(parts.year, parts.month, parts.day, 4, 0);
  if (ref.getTime() < start.getTime()) {
    const yesterday = new Date(start.getTime() - 24 * 3600 * 1000);
    const yp = sydneyDateParts(yesterday);
    start = sydneyWallClockToUtc(yp.year, yp.month, yp.day, 4, 0);
  }
  return start;
}

/**
 * Map timetable HH:MM onto the current Sydney service day (starts 04:00).
 * Handles after-midnight times (00:xx–03:xx → next calendar day) and GTFS
 * extended hours (e.g. 26:06 → 02:06 next day).
 */
export function occurrenceOnServiceDay(hhmm, ref = new Date()) {
  const [hRaw, mRaw] = String(hhmm || "00:00").split(":").map(Number);
  let totalMin = (Number.isFinite(hRaw) ? hRaw : 0) * 60 + (Number.isFinite(mRaw) ? mRaw : 0);
  let dayOffset = 0;
  while (totalMin >= 24 * 60) {
    totalMin -= 24 * 60;
    dayOffset += 1;
  }
  const hour = Math.floor(totalMin / 60);
  const minute = totalMin % 60;

  const dayStart = sydneyServiceDayStart(ref);
  const anchor = sydneyDateParts(dayStart);
  let year = anchor.year;
  let month = anchor.month;
  let day = anchor.day;

  if (hour < 4) {
    dayOffset += 1;
  }
  if (dayOffset > 0) {
    const shifted = new Date(Date.UTC(year, month - 1, day + dayOffset));
    const sp = sydneyDateParts(shifted);
    year = sp.year;
    month = sp.month;
    day = sp.day;
  }

  return sydneyWallClockToUtc(year, month, day, hour, minute);
}
