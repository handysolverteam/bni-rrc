import { describe, expect, it } from "vitest";
import { formatDisplayDate, formatDisplayMonth } from "../lib/date-format";

describe("formatDisplayDate", () => {
  it("formats ISO date strings for display", () => {
    expect(formatDisplayDate("2022-10-21")).toBe("21 Oct 2022");
  });

  it("formats single-digit days and months without leading zeroes", () => {
    expect(formatDisplayDate("2022-01-05")).toBe("5 Jan 2022");
  });

  it("returns a dash for missing or invalid dates", () => {
    expect(formatDisplayDate(null)).toBe("-");
    expect(formatDisplayDate(undefined)).toBe("-");
    expect(formatDisplayDate("")).toBe("-");
    expect(formatDisplayDate("not-a-date")).toBe("-");
    expect(formatDisplayDate("2022-02-31")).toBe("-");
  });
});

describe("formatDisplayMonth", () => {
  it("formats ISO month strings for display", () => {
    expect(formatDisplayMonth("2026-03-01")).toBe("Mar 2026");
  });

  it("returns a dash for missing or invalid months", () => {
    expect(formatDisplayMonth(null)).toBe("-");
    expect(formatDisplayMonth(undefined)).toBe("-");
    expect(formatDisplayMonth("")).toBe("-");
    expect(formatDisplayMonth("not-a-date")).toBe("-");
    expect(formatDisplayMonth("2026-13-01")).toBe("-");
  });
});
