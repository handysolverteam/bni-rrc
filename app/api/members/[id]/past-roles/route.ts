import { getServiceSupabase } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const roleId = typeof body?.role_id === "string" ? body.role_id : "";

  if (!roleId) {
    return Response.json({ error: "Role is required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: existingAssignments, error: existingAssignmentsError } = await supabase
    .from("member_past_roles")
    .select("display_order")
    .eq("member_id", id)
    .order("display_order", { ascending: false })
    .limit(1);

  if (existingAssignmentsError) {
    return Response.json({ error: existingAssignmentsError.message }, { status: 500 });
  }

  const nextDisplayOrder = (existingAssignments?.[0]?.display_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("member_past_roles")
    .insert({
      member_id: id,
      role_id: roleId,
      display_order: nextDisplayOrder,
    })
    .select("*, role:chapter_roles (*)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That role is already added for this member." }, { status: 409 });
    }

    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ pastRole: data }, { status: 201 });
}
