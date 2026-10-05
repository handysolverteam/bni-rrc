import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { sanitizeAliasName, normalizeAliasName } from "@/lib/renewals/member-aliases";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function POST(
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
  const aliasName = sanitizeAliasName(typeof body?.alias_name === "string" ? body.alias_name : "");

  if (!aliasName) {
    return Response.json({ error: "Alias is required." }, { status: 400 });
  }

  const normalizedAliasName = normalizeAliasName(aliasName);
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_aliases")
    .insert({
      member_id: id,
      alias_name: aliasName,
      normalized_alias_name: normalizedAliasName,
      source: "manual",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That alias is already added for this member." }, { status: 409 });
    }

    return internalErrorResponse(error, "Unable to add the alias.");
  }

  await invalidateCache([CACHE_TAGS.members]);
  return Response.json({ alias: data }, { status: 201 });
}
