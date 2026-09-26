import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { sanitizeRoleName, normalizeRoleName } from "@/lib/roles";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawName = typeof body?.name === "string" ? body.name : "";
  const name = sanitizeRoleName(rawName);

  if (!name) {
    return Response.json({ error: "Role name is required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("chapter_roles")
    .insert({
      name,
      normalized_name: normalizeRoleName(name),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That role already exists." }, { status: 409 });
    }

    return Response.json({ error: error.message }, { status: 500 });
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ role: data }, { status: 201 });
}
