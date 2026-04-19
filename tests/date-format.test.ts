import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "../lib/date-format";

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
