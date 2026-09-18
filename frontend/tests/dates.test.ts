import { describe, expect, it } from "vitest";
import {
  dayKey,
  eventsByDay,
  formatDate,
  monthGrid,
  moveMonth,
  parseDate,
  toISO,
  toLocalInput,
} from "../lib/dates";

describe("date boundaries", () => {
  it("does not crash on absent or legacy invalid dates", () => {
    expect(parseDate("Unknown")).toBeNull();
    expect(formatDate(null)).toBe("No date set");
    expect(toLocalInput("invalid")).toBe("");
    expect(toISO("")).toBeNull();
  });
  it("round-trips datetime-local without turning local time into UTC", () => {
    expect(toLocalInput("2026-09-18T14:30:00Z")).toBe("2026-09-18T10:30");
    expect(toISO("2026-09-18T10:30")).toBe("2026-09-18T14:30:00.000Z");
  });
  it("preserves seconds and DST offsets when a record's displayed date is unchanged", () => {
    expect(toISO("2026-09-18T10:30", "2026-09-18T14:30:37.123Z")).toBe(
      "2026-09-18T14:30:37.123Z",
    );
    expect(toISO("2026-11-01T01:30", "2026-11-01T06:30:00Z")).toBe(
      "2026-11-01T06:30:00Z",
    );
    expect(toISO("", "2026-09-18T14:30:37.123Z")).toBeNull();
  });
  it("handles daylight saving and rejects non-existent wall-clock times", () => {
    expect(toISO("2026-03-08T03:30")).toBe("2026-03-08T07:30:00.000Z");
    expect(() => toISO("2026-03-08T02:30")).toThrow("does not exist");
    expect(() => toISO("2026-02-30T12:00")).toThrow("does not exist");
  });
  it("navigates months from January 31 without skipping February", () => {
    expect(dayKey(moveMonth(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(dayKey(moveMonth(new Date(2026, 0, 31), -1))).toBe("2025-12-01");
  });
  it("always fills a six-week, Monday-first calendar", () => {
    const grid = monthGrid(new Date(2026, 1, 15));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(dayKey(grid[0])).toBe("2026-01-26");
    expect(dayKey(grid[41])).toBe("2026-03-08");
  });
  it("includes overnight events but excludes their exclusive end boundary", () => {
    const event = {
      start_time: "2026-09-18T23:00:00-04:00",
      end_time: "2026-09-20T00:00:00-04:00",
    };
    const grid = [
      new Date(2026, 8, 18),
      new Date(2026, 8, 19),
      new Date(2026, 8, 20),
    ];
    const indexed = eventsByDay([event], grid);
    expect(indexed.get("2026-09-18")).toHaveLength(1);
    expect(indexed.get("2026-09-19")).toHaveLength(1);
    expect(indexed.get("2026-09-20")).toHaveLength(0);
  });
});
