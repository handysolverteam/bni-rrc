import { getServiceSupabase } from "../supabase/server";
import type { Member, MemberAlias } from "../types";
import { normalizeImportKey } from "./import";

export type MemberNameMatch<TMember extends Pick<Member, "id" | "name">> = {
  name: string;
  matches: TMember[];
};

export function normalizeAliasName(value: string): string {
  return normalizeImportKey(value);
}

export function sanitizeAliasName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function buildMemberNameResolver<TMember extends Pick<Member, "id" | "name">>(
  members: TMember[],
  aliases: Array<Pick<MemberAlias, "member_id" | "normalized_alias_name">> = [],
) {
  const membersById = new Map(members.map((member) => [member.id, member]));
  const membersByCurrentName = new Map<string, TMember[]>();
  const membersByAlias = new Map<string, TMember[]>();

  for (const member of members) {
    const key = normalizeImportKey(member.name);
    membersByCurrentName.set(key, [...(membersByCurrentName.get(key) ?? []), member]);
  }

  for (const alias of aliases) {
    const member = membersById.get(alias.member_id);

    if (!member) {
      continue;
    }

    const key = alias.normalized_alias_name;
    const existing = membersByAlias.get(key) ?? [];

    if (!existing.some((item) => item.id === member.id)) {
      membersByAlias.set(key, [...existing, member]);
    }
  }

  return (name: string): TMember[] => {
    const key = normalizeImportKey(name);
    const currentMatches = membersByCurrentName.get(key) ?? [];

    if (currentMatches.length > 0) {
      return currentMatches;
    }

    return membersByAlias.get(key) ?? [];
  };
}

export function matchRowsByMemberName<TRow extends { name: string }, TMember extends Pick<Member, "id" | "name">>(
  rows: TRow[],
  members: TMember[],
  aliases: Array<Pick<MemberAlias, "member_id" | "normalized_alias_name">> = [],
): Array<{ row: TRow; matches: TMember[] }> {
  const resolveMemberName = buildMemberNameResolver(members, aliases);

  return rows.map((row) => ({
    row,
    matches: resolveMemberName(row.name),
  }));
}

export async function loadMemberAliases(): Promise<MemberAlias[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_aliases")
    .select("*")
    .order("alias_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MemberAlias[];
}

export async function getMemberAliases(memberId: string): Promise<MemberAlias[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_aliases")
    .select("*")
    .eq("member_id", memberId)
    .order("alias_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as MemberAlias[];
}
