import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getRenewalCycleUpdateForTaskStatus } from "@/lib/renewals/task-status";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";
import type { RenewalTask } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

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
    return internalErrorResponse(taskError, "Unable to load the task.");
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
    return internalErrorResponse(error, "Unable to update the task.");
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
      return internalErrorResponse(cycleError, "Unable to update the renewal cycle.");
    }
  }

  await invalidateCache([CACHE_TAGS.renewals]);
  return Response.json({ ok: true });
}
