/** Type surface for the standalone backfill script (test-only entry points). */
export interface LegacyBackfillCycleRow {
  id: string;
  member_id: string;
  renewal_year: number;
  renewal_date: string;
  reported_due_date: string | null;
  is_two_year_renewal: boolean;
  members: { name: string; industry: string } | null;
}

export interface LegacyBackfillCandidate {
  id: string;
  memberId: string;
  memberName: string;
  memberIndustry: string | null;
  previousRenewalYear: number;
  previousRenewalDate: string;
  nextRenewalYear: number;
  nextRenewalDate: string;
  reportedDueDate: string | null;
}

export function deriveLegacyTwoYearBackfillCandidates(
  cycles: LegacyBackfillCycleRow[],
  referenceYear: number,
): LegacyBackfillCandidate[];