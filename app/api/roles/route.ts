import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { sanitizeRoleName, normalizeRoleName } from "@/lib/roles";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

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

    return internalErrorResponse(error, "Unable to create the role.");
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ role: data }, { status: 201 });
}
