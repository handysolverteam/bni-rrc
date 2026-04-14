import { getServiceSupabase } from "@/lib/supabase/server";

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
  const { error } = await supabase
    .from("renewal_tasks")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
