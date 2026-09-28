import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  const { id, assignmentId } = await params;
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("member_past_roles")
    .delete()
    .eq("id", assignmentId)
    .eq("member_id", id);

  if (error) {
    return internalErrorResponse(error, "Unable to remove the role.");
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ ok: true });
}
