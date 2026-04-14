import { sendNotification } from "../notifications";
import { getServiceSupabase } from "../supabase/server";
import type { RenewalCycle, RenewalTaskType } from "../types";
import { getDerivedRenewalDates } from "./stage";

type Trigger = {
  type: RenewalTaskType;
  dueDate: string;
};

function todayDateOnly(today: Date): string {
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function getDueTaskTriggers(cycle: RenewalCycle, today = new Date()): Trigger[] {
  if (cycle.status !== "active") {
    return [];
  }

  const currentDate = todayDateOnly(today);
  const derived = getDerivedRenewalDates(cycle.renewal_date);
  const triggers: Trigger[] = [
    { type: "mc_discussion", dueDate: derived.mc_discussion_date },
    { type: "member_discussion", dueDate: derived.member_discussion_date },
    { type: "monthly_review", dueDate: derived.monthly_review_date },
    { type: "renewal_push", dueDate: derived.renewal_push_date },
    { type: "docs_collection", dueDate: derived.docs_deadline },
    { type: "critical_deadline", dueDate: derived.final_deadline },
  ];

  return triggers.filter((trigger) => currentDate >= trigger.dueDate);
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
