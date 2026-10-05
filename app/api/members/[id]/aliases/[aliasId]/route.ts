import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; aliasId: string }> },
) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  const { id, aliasId } = await params;
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("member_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("member_id", id);

  if (error) {
    return internalErrorResponse(error, "Unable to remove the alias.");
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ ok: true });
}
