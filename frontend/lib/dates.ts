export function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
export function formatDate(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, options).format(date)
    : "No date set";
}
export function formatTime(value?: string | null): string {
  return formatDate(value, { hour: "numeric", minute: "2-digit" });
}
export function toLocalInput(value?: string | null): string {
  const date = parseDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
export function toISO(value: string, original?: string | null): string | null {
  if (original && value && toLocalInput(original) === value) return original;
  if (!value) return null;
  const date = parseDate(value);
  if (!date) throw new Error("Please choose a valid date and time.");
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    toLocalInput(date.toISOString()) !== value
  ) {
    throw new Error(
      "That local date or time does not exist. Check the date and daylight-saving change.",
    );
  }
  return date.toISOString();
}
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  return Array.from(
    { length: 42 },
    (_, index) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}
export function moveMonth(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}
export function isOverdue(value: string | null, completed = false): boolean {
  const date = parseDate(value);
  return !completed && date !== null && date.getTime() < Date.now();
}
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
export function eventsByDay<T extends { start_time: string; end_time: string }>(
  events: T[],
  days: Date[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const day of days) {
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    result.set(
      dayKey(day),
      events.filter(
        (event) =>
          new Date(event.start_time) < end && new Date(event.end_time) > day,
      ),
    );
  }
  return result;
}
