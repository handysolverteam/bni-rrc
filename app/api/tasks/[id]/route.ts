import { getServiceSupabase } from "@/lib/supabase/server";
import { getRenewalCycleUpdateForTaskStatus } from "@/lib/renewals/task-status";
import type { RenewalTask } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const status = body.status;

  if (!["open", "completed", "cancelled"].includes(status)) {
    return Response.json({ error: "Invalid task status" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: task, error: taskError } = await supabase
    .from("renewal_tasks")
    .select("renewal_cycle_id, task_type")
    .eq("id", id)
    .single();

  if (taskError) {
    return Response.json({ error: taskError.message }, { status: 500 });
  }

  const completedAt = new Date();
  const { error } = await supabase
    .from("renewal_tasks")
    .update({
      status,
      completed_at: status === "completed" ? completedAt.toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const cycleUpdate = getRenewalCycleUpdateForTaskStatus(
    task.task_type as RenewalTask["task_type"],
    status,
    completedAt,
  );

  if (cycleUpdate) {
    const { error: cycleError } = await supabase
      .from("renewal_cycles")
      .update(cycleUpdate)
      .eq("id", task.renewal_cycle_id);

    if (cycleError) {
      return Response.json({ error: cycleError.message }, { status: 500 });
    }
  }

  return Response.json({ ok: true });
}
