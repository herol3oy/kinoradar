export const WARSAW_TIME_ZONE = "Europe/Warsaw";

const dateFormatter = new Intl.DateTimeFormat("en", {
  timeZone: WARSAW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en", {
  timeZone: WARSAW_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const offsetFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: WARSAW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsByType(formatter: Intl.DateTimeFormat, date: Date): Record<string, string> {
  return Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
}

/** Return the calendar date in Warsaw as a schedule/cache key. */
export function warsawDate(date: Date = new Date()): string {
  const { year, month, day } = partsByType(dateFormatter, date);
  return `${year}-${month}-${day}`;
}

/** Return minutes elapsed since midnight on the Warsaw clock. */
export function warsawTimeMinutes(date: Date = new Date()): number {
  const { hour, minute } = partsByType(timeFormatter, date);
  return Number(hour) * 60 + Number(minute);
}

export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function normalizeWarsawDate(value?: string, now: Date = new Date()): string {
  return value && isDateKey(value) ? value : warsawDate(now);
}

function warsawOffsetMs(date: Date): number {
  const parts = partsByType(offsetFormatter, date);
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ) - Math.trunc(date.getTime() / 1000) * 1000;
}

/** Return the Unix timestamp for midnight on a Warsaw calendar date. */
export function warsawMidnightEpochSeconds(day: string): number {
  if (!isDateKey(day)) throw new RangeError(`Invalid date key: ${day}`);
  const [year, month, date] = day.split("-").map(Number);
  const localClock = Date.UTC(year, month - 1, date);
  let instant = localClock;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = localClock - warsawOffsetMs(new Date(instant));
  }
  return Math.trunc(instant / 1000);
}

/** Add calendar days without involving the host or visitor's local time zone. */
export function addCalendarDays(value: string, days: number): string {
  if (!isDateKey(value)) throw new RangeError(`Invalid date key: ${value}`);

  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return [result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
    .join("-");
}

export function warsawDateRange(length: number, now: Date = new Date()): string[] {
  const today = warsawDate(now);
  return Array.from({ length }, (_, index) => addCalendarDays(today, index));
}
