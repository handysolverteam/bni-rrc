import type { DerivedRenewalDates, RenewalCycle, RenewalStage } from "../types";

function parseDateOnly(date: string): Date {
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getDerivedRenewalDates(renewalDate: string): DerivedRenewalDates {
  const renewal = parseDateOnly(renewalDate);
  const finalDeadline = new Date(
    Date.UTC(renewal.getUTCFullYear(), renewal.getUTCMonth() - 1, 15),
  );

  return {
    mc_discussion_date: toDateOnly(addDays(renewal, -120)),
    member_discussion_date: toDateOnly(addDays(renewal, -90)),
    monthly_review_date: toDateOnly(addDays(renewal, -60)),
    renewal_push_date: toDateOnly(addDays(renewal, -45)),
    docs_deadline: toDateOnly(addDays(renewal, -30)),
    final_deadline: toDateOnly(finalDeadline),
  };
}

export function calculateStage(
  renewalCycle: Pick<RenewalCycle, "renewal_date" | "status">,
  today = new Date(),
): RenewalStage {
  if (renewalCycle.status === "renewed") {
    return "Renewed";
  }

  if (renewalCycle.status === "dropped") {
    return "Dropped";
  }

  const todayOnly = toDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
  );
  const derived = getDerivedRenewalDates(renewalCycle.renewal_date);

  if (todayOnly >= derived.final_deadline) {
    return "Critical Deadline";
  }
  if (todayOnly >= derived.docs_deadline) {
    return "Docs Pending";
  }
  if (todayOnly >= derived.renewal_push_date) {
    return "Renewal Due";
  }
  if (todayOnly >= derived.monthly_review_date) {
    return "Monthly Review";
  }
  if (todayOnly >= derived.member_discussion_date) {
    return "Member Discussion";
  }
  if (todayOnly >= derived.mc_discussion_date) {
    return "MC Discussion Due";
  }

  return "Upcoming";
}

export const renewalStages: RenewalStage[] = [
  "Upcoming",
  "MC Discussion Due",
  "Member Discussion",
  "Monthly Review",
  "Renewal Due",
  "Docs Pending",
  "Critical Deadline",
  "Renewed",
  "Dropped",
];
