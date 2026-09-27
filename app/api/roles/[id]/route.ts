import { normalizeRoleName, sanitizeRoleName } from "@/lib/roles";
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

    return internalErrorResponse(error, "Unable to update the role.");
  }

  return Response.json({ role: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;
  const supabase = getServiceSupabase();
  const { count, error: countError } = await supabase
    .from("member_past_roles")
    .select("*", { count: "exact", head: true })
    .eq("role_id", id);

  if (countError) {
    return internalErrorResponse(countError, "Unable to check role usage.");
  }

  if ((count ?? 0) > 0) {
    return Response.json(
      { error: "Remove this role from members before deleting it." },
      { status: 409 },
    );
  }

  const { error } = await supabase.from("chapter_roles").delete().eq("id", id);

  if (error) {
    return internalErrorResponse(error, "Unable to delete the role.");
  }

  return Response.json({ ok: true });
}
