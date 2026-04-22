import type { MemberTrafficLight } from "../types";
import { PAST_YEAR_TRAFFIC_LIGHT_LIMIT, sortTrafficLightHistoryForDisplay } from "./traffic-light-history";

export type PastYearPerformance = {
  history: MemberTrafficLight[];
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
    testimonials: number;
    trainings: number;
    tyfcb: number | null;
  };
  scores: {
    average: number | null;
    best: number | null;
    worst: number | null;
  };
};

export function buildPastYearPerformance(history: MemberTrafficLight[]): PastYearPerformance {
  const selectedHistory = [...history]
    .sort((left, right) => right.report_month.localeCompare(left.report_month))
    .slice(0, PAST_YEAR_TRAFFIC_LIGHT_LIMIT);

  const displayHistory = sortTrafficLightHistoryForDisplay(selectedHistory);
  const monthsCovered = selectedHistory.length;

  if (monthsCovered === 0) {
    return {
      history: [],
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
        testimonials: 0,
        trainings: 0,
        tyfcb: null,
      },
      scores: {
        average: null,
        best: null,
        worst: null,
      },
    };
  }

  const scoreTotal = selectedHistory.reduce((sum, item) => sum + item.score, 0);

  return {
    history: displayHistory,
    monthsCovered,
    totals: {
      presents: selectedHistory.reduce((sum, item) => sum + item.present_count, 0),
      absences: selectedHistory.reduce((sum, item) => sum + item.absent_count, 0),
      late: selectedHistory.reduce((sum, item) => sum + item.late_count, 0),
      medical: selectedHistory.reduce((sum, item) => sum + item.medical_count, 0),
      substitute: selectedHistory.reduce((sum, item) => sum + item.substitute_count, 0),
      referralsGiven: selectedHistory.reduce((sum, item) => sum + item.referrals_given, 0),
      referralsReceived: selectedHistory.reduce((sum, item) => sum + item.referrals_received, 0),
      visitors: selectedHistory.reduce((sum, item) => sum + item.visitors, 0),
      testimonials: selectedHistory.reduce((sum, item) => sum + item.testimonials, 0),
      trainings: selectedHistory.reduce((sum, item) => sum + item.trainings, 0),
      tyfcb: selectedHistory.reduce((sum, item) => sum + (item.tyfcb ?? 0), 0),
    },
    scores: {
      average: Number((scoreTotal / monthsCovered).toFixed(1)),
      best: Math.max(...selectedHistory.map((item) => item.score)),
      worst: Math.min(...selectedHistory.map((item) => item.score)),
    },
  };
}
