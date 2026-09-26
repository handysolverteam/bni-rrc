import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { normalizeRoleName, sanitizeRoleName } from "@/lib/roles";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = sanitizeRoleName(rawName);

  if (!name) {
    return Response.json({ error: "Role name is required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("chapter_roles")
    .update({
      name,
      normalized_name: normalizeRoleName(name),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return Response.json({ error: "Role not found." }, { status: 404 });
    }

    if (error.code === "23505") {
      return Response.json({ error: "That role already exists." }, { status: 409 });
    }

    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ role: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getServiceSupabase();
  const { count, error: countError } = await supabase
    .from("member_past_roles")
    .select("*", { count: "exact", head: true })
    .eq("role_id", id);

  if (countError) {
    return Response.json({ error: countError.message }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "Remove this role from members before deleting it." },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("chapter_roles").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
