import { formatDisplayDate, formatDisplayMonth } from "../date-format";
import type { MonthlyPalmsPerformance } from "./palms-monthly-performance";
import type { PastYearPerformance } from "./past-year-performance";
import type { PastYearTrainingPerformance } from "./past-year-training-performance";

function formatNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTrafficLightSummary(performance: PastYearPerformance): string | null {
  if (performance.history.length === 0) {
    return null;
  }

  return [...performance.history]
    .reverse()
    .map((trafficLight) => {
      const colorEmoji =
        trafficLight.color === "green"
          ? "ðŸŸ¢"
          : trafficLight.color === "yellow"
            ? "ðŸŸ¡"
            : trafficLight.color === "red"
              ? "ðŸ”´"
              : "âšª";

      const label = trafficLight.report_window_end ?? trafficLight.report_month;
      return `${formatDisplayMonth(label).split(" ")[0]} ${trafficLight.score} ${colorEmoji}`;
    })
    .join(" | ");
}

export function buildMemberPerformanceShareText({
  memberName,
  palmsPerformance,
  palmsRange,
  trainingPerformance,
  trainingRange,
  trafficLightPerformance,
  trafficLightRange,
}: {
  memberName: string;
  palmsPerformance: MonthlyPalmsPerformance;
  palmsRange: string | null;
  trainingPerformance: PastYearTrainingPerformance;
  trainingRange: string | null;
  trafficLightPerformance: PastYearPerformance;
  trafficLightRange: string | null;
}): string {
  const lines = [
    `ðŸŒŸ Past year performance of ${memberName} ðŸŒŸ`,
    "",
    `ðŸ“… Monthly PALMS coverage: ${palmsPerformance.monthsCovered} month${palmsPerformance.monthsCovered === 1 ? "" : "s"}`,
  ];

  if (palmsRange) {
    lines.push(`ðŸ“Œ PALMS range: ${palmsRange}`);
  }

  if (trafficLightRange) {
    lines.push(`ðŸš¦ Traffic-light range: ${trafficLightRange}`);
  }

  if (trainingRange) {
    lines.push(`ðŸ“š Training range: ${trainingRange}`);
  }

  lines.push("");
  lines.push(`ðŸ¤ Referrals given: ${formatNumber(palmsPerformance.totals.referralsGiven)}`);
  lines.push(`ðŸ“¥ Referrals received: ${formatNumber(palmsPerformance.totals.referralsReceived)}`);
  lines.push(`ðŸ™Œ Visitors: ${formatNumber(palmsPerformance.totals.visitors)}`);
  lines.push(`ðŸ‘¥ 1-to-1s: ${formatNumber(palmsPerformance.totals.oneToOnes)}`);
  lines.push(`ðŸ’° TYFCB: ${formatCurrency(palmsPerformance.totals.tyfcb)}`);
  lines.push(`âœ… Presents: ${formatNumber(palmsPerformance.totals.presents)}`);
  lines.push(`âš ï¸ Absences: ${formatNumber(palmsPerformance.totals.absences)}`);
  lines.push(`ðŸŽ“ CEU: ${formatNumber(palmsPerformance.totals.ceu)}`);
  lines.push(`ðŸ“š Trainings: ${formatNumber(trainingPerformance.count)}`);

  if (trafficLightPerformance.snapshotsCovered > 0) {
    lines.push("");
    lines.push(
      `ðŸ“ˆ Traffic-light score: Avg ${formatNumber(trafficLightPerformance.scores.average)} | Best ${formatNumber(trafficLightPerformance.scores.best)} | Worst ${formatNumber(trafficLightPerformance.scores.worst)}`,
    );
  }

  const trafficLightSummary = formatTrafficLightSummary(trafficLightPerformance);

  if (trafficLightSummary) {
    lines.push("");
    lines.push("ðŸš¦ Last 12 traffic-light snapshots:");
    lines.push(trafficLightSummary);
  }

  if (palmsPerformance.monthlySnapshots.length > 0) {
    lines.push("");
    lines.push(
      `ðŸ—“ï¸ Performance updated till ${formatDisplayDate(
        palmsPerformance.monthlySnapshots[palmsPerformance.monthlySnapshots.length - 1].report_to,
      )}`,
    );
  }

  lines.push("");
  lines.push("ðŸ‘ Congratulations on the consistency and contribution!");
  lines.push("");
  lines.push("Regards,");
  lines.push("Retention and Renewal Coordinators");
  lines.push("Team Moneyfestation");

  return lines.join("\n");
}
