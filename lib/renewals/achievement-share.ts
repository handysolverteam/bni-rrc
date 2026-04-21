import { formatDisplayDate, formatDisplayMonth } from "../date-format";
import type { MemberAchievements } from "./achievements";
import type { MemberPastRoleEntry, MemberTrafficLight } from "../types";
import { sortTrafficLightHistoryForDisplay } from "./traffic-light-history";

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

function formatTrafficLightSummary(history: MemberTrafficLight[]): string | null {
  const recentTrafficLights = sortTrafficLightHistoryForDisplay(history).slice(-6).reverse();

  if (recentTrafficLights.length === 0) {
    return null;
  }

  return recentTrafficLights
    .map((trafficLight) => {
      const color = `${trafficLight.color[0].toUpperCase()}${trafficLight.color.slice(1)}`;
      return `${formatDisplayMonth(trafficLight.report_month).split(" ")[0]} ${color}`;
    })
    .join(", ");
}

export function buildMemberAchievementShareText({
  memberName,
  roles,
  renewalLabel,
  tenureLabel,
  joiningDateLabel,
  achievements,
  trafficLightHistory,
}: {
  memberName: string;
  roles: MemberPastRoleEntry[];
  renewalLabel: string;
  tenureLabel: string;
  joiningDateLabel: string;
  achievements: MemberAchievements;
  trafficLightHistory: MemberTrafficLight[];
}): string {
  const lines = [
    `Celebrating ${memberName}`,
    `Roles held: ${roles.length > 0 ? roles.map((pastRole) => pastRole.role.name).join(", ") : "No past roles added yet"}`,
    renewalLabel,
    `Member for ${tenureLabel} | Joined ${joiningDateLabel === "-" ? "Joining date not set" : joiningDateLabel}`,
    `Referrals given: ${formatNumber(achievements.referrals.givenTotal)} | 1-to-1s: ${formatNumber(achievements.oneToOnes)}`,
    `TYFCB: ${formatCurrency(achievements.tyfcb)} | Visitors: ${formatNumber(achievements.visitors)}`,
    `Absences: ${formatNumber(achievements.attendance.absences)}`,
  ];

  const trafficLightSummary = formatTrafficLightSummary(trafficLightHistory);

  if (trafficLightSummary) {
    lines.push(`Last 6 months: ${trafficLightSummary}`);
  }

  if (achievements.source === "palms" && achievements.reportTo) {
    lines.push(`Achievements updated till ${formatDisplayDate(achievements.reportTo)}`);
  }

  return lines.join("\n");
}

