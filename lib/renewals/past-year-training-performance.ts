import type { MemberTrainingAchievement } from "../types";

export type PastYearTrainingPerformance = {
  count: number;
  anchorDate: string;
  windowStart: string;
  items: MemberTrainingAchievement[];
};

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildPastYearTrainingPerformance(
  trainingAchievements: MemberTrainingAchievement[],
  anchorDateInput: string | Date,
): PastYearTrainingPerformance {
  const anchorDate =
    typeof anchorDateInput === "string" ? parseDateOnly(anchorDateInput) : new Date(anchorDateInput);
  const windowStartDate = new Date(anchorDate);
  windowStartDate.setUTCFullYear(windowStartDate.getUTCFullYear() - 1);
  windowStartDate.setUTCDate(windowStartDate.getUTCDate() + 1);

  const anchorDateText = formatDateOnly(anchorDate);
  const windowStartText = formatDateOnly(windowStartDate);

  const items = [...trainingAchievements]
    .filter(
      (achievement) =>
        achievement.event_date >= windowStartText && achievement.event_date <= anchorDateText,
    )
    .sort((left, right) => {
      if (left.event_date === right.event_date) {
        return left.event_type.localeCompare(right.event_type);
      }

      return right.event_date.localeCompare(left.event_date);
    });

  return {
    count: items.length,
    anchorDate: anchorDateText,
    windowStart: windowStartText,
    items,
  };
}
