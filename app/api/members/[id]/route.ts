import { CACHE_TAGS, getMemberDetail, invalidateCache } from "@/lib/cache";
import { normalizeAliasName, sanitizeAliasName } from "@/lib/renewals/member-aliases";
import { getServiceSupabase } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const member = await getMemberDetail(id);
    return Response.json(member);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to fetch member" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    return Response.json({ error: existingMemberError.message }, { status: 500 });
  }

  const previousName = sanitizeAliasName(existingMember.name ?? "");
  const { data, error } = await supabase
    .from("members")
    .update({ name: nextName })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
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
      return Response.json({ error: aliasError.message }, { status: 500 });
    }
  }

  await invalidateCache([CACHE_TAGS.renewals, CACHE_TAGS.members]);
  return Response.json({ member: data });
}
