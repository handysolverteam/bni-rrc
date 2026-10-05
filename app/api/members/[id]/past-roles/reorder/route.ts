import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { buildRoleOrderUpdates } from "@/lib/roles";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

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
  const body = await request.json().catch(() => null);
  const rawAssignmentIds = Array.isArray(body?.assignment_ids) ? (body.assignment_ids as unknown[]) : [];
  const assignmentIds = Array.isArray(body?.assignment_ids)
    ? rawAssignmentIds.filter((item): item is string => typeof item === "string")
    : [];

  const supabase = getServiceSupabase();
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("member_past_roles")
    .select("id")
    .eq("member_id", id)
    .order("display_order", { ascending: true });

  if (existingRowsError) {
    return internalErrorResponse(existingRowsError, "Unable to load existing roles.");
  }

  if (assignmentIds.length !== (existingRows ?? []).length) {
    return Response.json({ error: "Reorder request must include every member role entry." }, { status: 400 });
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));
  const providedIds = new Set(assignmentIds);

  if (providedIds.size !== assignmentIds.length || assignmentIds.some((assignmentId) => !existingIds.has(assignmentId))) {
    return Response.json({ error: "Invalid role order submitted." }, { status: 400 });
  }

  const updates = buildRoleOrderUpdates(assignmentIds);
  for (const update of updates) {
    const { error } = await supabase
      .from("member_past_roles")
      .update({ display_order: update.display_order })
      .eq("id", update.id)
      .eq("member_id", id);

    if (error) {
      return internalErrorResponse(error, "Unable to reorder the roles.");
    }
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ ok: true });
}
