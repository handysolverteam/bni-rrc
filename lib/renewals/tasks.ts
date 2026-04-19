import { sendNotification } from "../notifications";
import { getServiceSupabase } from "../supabase/server";
import type { RenewalCycle, RenewalTaskType } from "../types";
import { getDerivedRenewalDates, isWithinRenewalWorkWindow } from "./stage";

type Trigger = {
  type: RenewalTaskType;
  dueDate: string;
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() + mondayOffset);
  return weekStart;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfNextWeekDateOnly(today: Date): string {
  return toDateOnly(addDays(startOfUtcWeek(today), 13));
}

export function getDueTaskTriggers(cycle: RenewalCycle, today = new Date()): Trigger[] {
  if (cycle.status !== "active" || !isWithinRenewalWorkWindow(cycle.renewal_date, today)) {
    return [];
  }

  const horizonDate = endOfNextWeekDateOnly(today);
  const derived = getDerivedRenewalDates(cycle.renewal_date);
  const triggers: Trigger[] = [
    { type: "mc_discussion", dueDate: derived.mc_discussion_date },
    { type: "member_discussion", dueDate: derived.member_discussion_date },
    { type: "docs_collection", dueDate: derived.documents_sent_date },
    { type: "payment_due", dueDate: derived.payment_due_date },
  ];

  return triggers.filter((trigger) => horizonDate >= trigger.dueDate);
}

export async function generateRenewalTasks(today = new Date()) {
  const supabase = getServiceSupabase();
  const { data: cycles, error } = await supabase
    .from("renewal_cycles")
    .select("*")
    .eq("status", "active");

  if (error) {
    throw error;
  }

  let createdCount = 0;

  for (const cycle of (cycles ?? []) as RenewalCycle[]) {
    for (const trigger of getDueTaskTriggers(cycle, today)) {
      const { data, error: insertError } = await supabase
        .from("renewal_tasks")
        .insert({
          renewal_cycle_id: cycle.id,
          task_type: trigger.type,
          due_date: trigger.dueDate,
        })
        .select("id")
        .single();

      if (!insertError && data) {
        createdCount += 1;
        await sendNotification(cycle, trigger.type);
      }

      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }
    }
  }

  return {
    scannedCount: cycles?.length ?? 0,
    createdCount,
  };
}
