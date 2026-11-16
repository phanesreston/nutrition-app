/** Calendar days are handled as ISO strings (YYYY-MM-DD) to avoid timezone drift. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Today's date in the server's local timezone (the same machine as the user for a local app). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** UTC-midnight Date for a calendar day, as stored in a Postgres DATE column. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function shiftDay(day: string, deltaDays: number): string {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function formatDay(day: string, today: string = todayIso()): string {
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  if (day === shiftDay(today, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(dayToDate(day));
}

/** Resolve a `?date=` search param to a valid day, defaulting to today. */
export function resolveDay(param: string | string[] | undefined, today: string = todayIso()): string {
  const value = Array.isArray(param) ? param[0] : param;
  return isIsoDay(value) ? value : today;
}
