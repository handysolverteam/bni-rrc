import type { MemberPalmsSnapshot } from "../types";

export type MonthlyPalmsPerformance = {
  monthlySnapshots: MemberPalmsSnapshot[];
  monthsCovered: number;
  totals: {
    presents: number;
    absences: number;
    late: number;
    medical: number;
    substitute: number;
    referralsGiven: number;
    referralsReceived: number;
    visitors: number;
    oneToOnes: number;
    tyfcb: number | null;
    ceu: number;
    trainings: number;
  };
};

function getMonthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function isExactMonthlyPalmsSnapshot(snapshot: MemberPalmsSnapshot): boolean {
  const from = new Date(`${snapshot.report_from}T00:00:00.000Z`);
  const to = new Date(`${snapshot.report_to}T00:00:00.000Z`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return false;
  }

  return (
    from.getUTCFullYear() === to.getUTCFullYear() &&
    from.getUTCMonth() === to.getUTCMonth() &&
    from.getUTCDate() === 1 &&
    to.getUTCDate() === getMonthEnd(from).getUTCDate()
  );
}

export function buildMonthlyPalmsPerformance(
  snapshots: MemberPalmsSnapshot[],
  limit = 12,
): MonthlyPalmsPerformance {
  const monthlySnapshots = [...snapshots]
    .filter(isExactMonthlyPalmsSnapshot)
    .sort((left, right) => right.report_to.localeCompare(left.report_to))
    .slice(0, limit)
    .sort((left, right) => left.report_to.localeCompare(right.report_to));

  if (monthlySnapshots.length === 0) {
    return {
      monthlySnapshots: [],
      monthsCovered: 0,
      totals: {
        presents: 0,
        absences: 0,
        late: 0,
        medical: 0,
        substitute: 0,
        referralsGiven: 0,
        referralsReceived: 0,
        visitors: 0,
        oneToOnes: 0,
        tyfcb: null,
        ceu: 0,
        trainings: 0,
      },
    };
  }

  return {
    monthlySnapshots,
    monthsCovered: monthlySnapshots.length,
    totals: {
      presents: monthlySnapshots.reduce((sum, item) => sum + item.present_count, 0),
      absences: monthlySnapshots.reduce((sum, item) => sum + item.absent_count, 0),
      late: monthlySnapshots.reduce((sum, item) => sum + item.late_count, 0),
      medical: monthlySnapshots.reduce((sum, item) => sum + item.medical_count, 0),
      substitute: monthlySnapshots.reduce((sum, item) => sum + item.substitute_count, 0),
      referralsGiven: monthlySnapshots.reduce(
        (sum, item) => sum + item.referrals_given_inside + item.referrals_given_outside,
        0,
      ),
      referralsReceived: monthlySnapshots.reduce(
        (sum, item) => sum + item.referrals_received_inside + item.referrals_received_outside,
        0,
      ),
      visitors: monthlySnapshots.reduce((sum, item) => sum + item.visitors, 0),
      oneToOnes: monthlySnapshots.reduce((sum, item) => sum + item.one_to_ones, 0),
      tyfcb: monthlySnapshots.reduce((sum, item) => sum + (item.tyfcb ?? 0), 0),
      ceu: monthlySnapshots.reduce((sum, item) => sum + item.ceu, 0),
      trainings: monthlySnapshots.reduce((sum, item) => sum + item.trainings, 0),
    },
  };
}
