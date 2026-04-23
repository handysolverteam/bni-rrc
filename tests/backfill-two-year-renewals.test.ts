import { describe, expect, it } from "vitest";
import { deriveLegacyTwoYearBackfillCandidates } from "../scripts/backfill-two-year-renewals.mjs";

describe("legacy two-year renewal backfill", () => {
  it("selects next-year-only rows and converts them to the annual workflow year", () => {
    expect(
      deriveLegacyTwoYearBackfillCandidates(
        [
          {
            id: "cycle-1",
            member_id: "member-1",
            renewal_year: 2027,
            renewal_date: "2027-07-01",
            reported_due_date: null,
            is_two_year_renewal: false,
            members: { name: "Nitin Sharma- Chef", industry: "Caterer" },
          },
        ],
        2026,
      ),
    ).toEqual([
      {
        id: "cycle-1",
        memberId: "member-1",
        memberName: "Nitin Sharma- Chef",
        memberIndustry: "Caterer",
        previousRenewalYear: 2027,
        previousRenewalDate: "2027-07-01",
        nextRenewalYear: 2026,
        nextRenewalDate: "2026-07-01",
        reportedDueDate: "2027-07-01",
      },
    ]);
  });

  it("skips rows that already have a current-year annual cycle", () => {
    expect(
      deriveLegacyTwoYearBackfillCandidates(
        [
          {
            id: "cycle-1",
            member_id: "member-1",
            renewal_year: 2026,
            renewal_date: "2026-07-01",
            reported_due_date: null,
            is_two_year_renewal: false,
            members: { name: "Nitin Sharma- Chef", industry: "Caterer" },
          },
          {
            id: "cycle-2",
            member_id: "member-1",
            renewal_year: 2027,
            renewal_date: "2027-07-01",
            reported_due_date: null,
            is_two_year_renewal: false,
            members: { name: "Nitin Sharma- Chef", industry: "Caterer" },
          },
        ],
        2026,
      ),
    ).toEqual([]);
  });

  it("skips rows that are more than one year ahead", () => {
    expect(
      deriveLegacyTwoYearBackfillCandidates(
        [
          {
            id: "cycle-1",
            member_id: "member-1",
            renewal_year: 2028,
            renewal_date: "2028-07-01",
            reported_due_date: null,
            is_two_year_renewal: false,
            members: { name: "Nitin Sharma- Chef", industry: "Caterer" },
          },
        ],
        2026,
      ),
    ).toEqual([]);
  });

  it("skips rows that were already backfilled", () => {
    expect(
      deriveLegacyTwoYearBackfillCandidates(
        [
          {
            id: "cycle-1",
            member_id: "member-1",
            renewal_year: 2026,
            renewal_date: "2026-07-01",
            reported_due_date: "2027-07-01",
            is_two_year_renewal: true,
            members: { name: "Nitin Sharma- Chef", industry: "Caterer" },
          },
        ],
        2026,
      ),
    ).toEqual([]);
  });
});
