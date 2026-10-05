import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { buildChecklistUpdates } from "@/lib/renewals/checklist";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

const editableFields = [
  "status",
  "last_followup_date",
  "next_followup_date",
] as const;

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
  const supabase = getServiceSupabase();
  const updates: Record<string, unknown> = {};

  for (const field of editableFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  Object.assign(updates, buildChecklistUpdates(body));

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("renewal_cycles").update(updates).eq("id", id);

    if (error) {
      return internalErrorResponse(error, "Unable to save the renewal cycle.");
    }
  }

  if (Array.isArray(body.assignments)) {
    for (const assignment of body.assignments) {
      if (![1, 2].includes(assignment.slot)) {
        continue;
      }

      if (assignment.assignee_member_id) {
        const { error } = await supabase.from("renewal_assignments").upsert(
          {
            renewal_cycle_id: id,
            slot: assignment.slot,
            assignee_member_id: assignment.assignee_member_id,
          },
          { onConflict: "renewal_cycle_id,slot" },
        );

        if (error) {
          await invalidateCache([CACHE_TAGS.renewals]);
          return internalErrorResponse(error, "Unable to save the renewal cycle.");
        }
      } else {
        const { error } = await supabase
          .from("renewal_assignments")
          .delete()
          .eq("renewal_cycle_id", id)
          .eq("slot", assignment.slot);

        if (error) {
          await invalidateCache([CACHE_TAGS.renewals]);
          return internalErrorResponse(error, "Unable to save the renewal cycle.");
        }
      }
    }
  }

  await invalidateCache([CACHE_TAGS.renewals]);
  return Response.json({ ok: true });
}
