import { CACHE_TAGS, getMemberDetail, invalidateCache } from "@/lib/cache";
import { normalizeAliasName, sanitizeAliasName } from "@/lib/renewals/member-aliases";
import { getServiceSupabase } from "@/lib/supabase/server";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  try {
    const member = await getMemberDetail(id);
    return Response.json(member);
  } catch (error) {
    return internalErrorResponse(error, "Unable to fetch member.");
  }
}

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
  const nextName = sanitizeAliasName(typeof body?.name === "string" ? body.name : "");

  if (!nextName) {
    return Response.json({ error: "Member name is required." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data: existingMember, error: existingMemberError } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .single();

  if (existingMemberError) {
    return internalErrorResponse(existingMemberError, "Unable to update member.");
  }

  const previousName = sanitizeAliasName(existingMember.name ?? "");
  const { data, error } = await supabase
    .from("members")
    .update({ name: nextName })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return internalErrorResponse(error, "Unable to update member.");
  }

  if (previousName && normalizeAliasName(previousName) !== normalizeAliasName(nextName)) {
    const { error: aliasError } = await supabase
      .from("member_aliases")
      .upsert(
        {
          member_id: id,
          alias_name: previousName,
          normalized_alias_name: normalizeAliasName(previousName),
          source: "rename",
        },
        { onConflict: "member_id,normalized_alias_name" },
      );

    if (aliasError) {
      return internalErrorResponse(aliasError, "Unable to save the previous name.");
    }
  }

  await invalidateCache([CACHE_TAGS.renewals, CACHE_TAGS.members]);
  return Response.json({ member: data });
}
