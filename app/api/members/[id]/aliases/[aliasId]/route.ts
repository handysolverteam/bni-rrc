import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; aliasId: string }> },
) {
  const { id, aliasId } = await params;
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("member_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("member_id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ ok: true });
}
