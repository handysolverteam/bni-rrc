import { describe, expect, it } from "vitest";
import {
  deriveImportedRenewalCycle,
  getImportReferenceYear,
} from "../lib/renewals/database-import";

describe("membership dues import cycle derivation", () => {
  it("uses the report year as the annual workflow year for next-year due dates", () => {
    expect(deriveImportedRenewalCycle("2027-07-01", 2026)).toEqual({
      renewalYear: 2026,
      renewalDate: "2026-07-01",
      reportedDueDate: "2027-07-01",
      isTwoYearRenewal: true,
    });
  });

  it("keeps same-year renewals unchanged", () => {
    expect(deriveImportedRenewalCycle("2026-07-01", 2026)).toEqual({
      renewalYear: 2026,
      renewalDate: "2026-07-01",
      reportedDueDate: null,
      isTwoYearRenewal: false,
    });
  });

  it("falls back to the current UTC year when a report date is unavailable", () => {
    expect(getImportReferenceYear(null, new Date("2026-04-22T00:00:00.000Z"))).toBe(2026);
  });

  it("prefers the report date year when present", () => {
    expect(getImportReferenceYear("2026-04-14", new Date("2025-01-01T00:00:00.000Z"))).toBe(2026);
  });
});
