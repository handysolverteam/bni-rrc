import { getServiceSupabase } from "../supabase/server";
import type { Member } from "../types";
import { normalizeImportKey } from "./import";
import { normalizeAliasName, sanitizeAliasName } from "./member-aliases";

/**
 * What to do with a name in an import file that matches no member (or alias):
 * create it as a new member, link it to an existing member (typo/variant -> saved as an
 * alias so future imports match automatically), or skip its rows.
 */
export type NameResolution =
  | { action: "create" }
  | { action: "link"; memberId: string }
  | { action: "skip" };

/** Keyed by normalizeImportKey(name). */
export type NameResolutions = Record<string, NameResolution>;

export type MemberSuggestion = { memberId: string; name: string; score: number };

export type UnmatchedName = {
  key: string;
  name: string;
  suggestions: MemberSuggestion[];
};

export type ReviewMember = { id: string; name: string };

/** Counts + per-file lines + decisions needed; the shape the import review panel renders. */
export type ImportPreview = {
  summary: {
    toImport: number;
    toOverwrite: number;
    unchanged: number;
    needsDecision: number;
    failed: number;
  };
  files: Array<{
    label: string;
    detail: string | null;
    toImport: number;
    toOverwrite: number;
    unchanged: number;
    needsDecision: number;
    error: string | null;
  }>;
  unmatched: UnmatchedName[];
  members: ReviewMember[];
};

export type ResolutionOutcome = {
  resolved: Map<string, Member>;
  createdMembers: string[];
  linkedNames: Array<{ name: string; memberName: string }>;
  skippedNames: string[];
  errors: string[];
};

const SUGGESTION_THRESHOLD = 0.72;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }

    previous = current;
  }

  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}

export function nameSimilarity(left: string, right: string): number {
  const a = normalizeImportKey(left);
  const b = normalizeImportKey(right);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = a.split(" ");
  const tokensB = b.split(" ");
  const sortedA = [...tokensA].sort().join(" ");
  const sortedB = [...tokensB].sort().join(" ");
  let score = Math.max(similarity(a, b), similarity(sortedA, sortedB));

  // "Nitin Sharma Chef" vs "Nitin Sharma": one name's words fully contained in the other's.
  const [shorter, longer] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  if (shorter.length >= 2 && shorter.every((token) => longer.includes(token))) {
    score = Math.max(score, 0.85);
  }

  return score;
}

export function suggestMembers(
  name: string,
  members: Array<Pick<Member, "id" | "name">>,
  limit = 3,
): MemberSuggestion[] {
  return members
    .map((member) => ({
      memberId: member.id,
      name: member.name,
      score: Math.round(nameSimilarity(name, member.name) * 100) / 100,
    }))
    .filter((suggestion) => suggestion.score >= SUGGESTION_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function buildUnmatchedNames(
  names: string[],
  members: Array<Pick<Member, "id" | "name">>,
): UnmatchedName[] {
  const byKey = new Map<string, UnmatchedName>();

  for (const name of names) {
    const key = normalizeImportKey(name);

    if (!byKey.has(key)) {
      byKey.set(key, { key, name, suggestions: suggestMembers(name, members) });
    }
  }

  return [...byKey.values()];
}

export function parseResolutions(raw: unknown): NameResolutions {
  if (typeof raw !== "string" || raw.trim() === "") {
    return {};
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Invalid resolutions payload.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid resolutions payload.");
  }

  const result: NameResolutions = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const action = (entry as { action?: unknown } | null)?.action;

    if (action === "create" || action === "skip") {
      result[key] = { action };
    } else if (action === "link" && typeof (entry as { memberId?: unknown }).memberId === "string") {
      result[key] = { action, memberId: (entry as { memberId: string }).memberId };
    } else {
      throw new Error("Invalid resolutions payload.");
    }
  }

  return result;
}

/**
 * Applies the user's decisions for unmatched names. A name with no decision is skipped (never
 * created implicitly). Linked memberIds are checked against the current members table, so a
 * forged id can't attach data to something that doesn't exist.
 */
export async function resolveUnmatchedNames(
  unmatched: Array<{ key: string; name: string }>,
  resolutions: NameResolutions,
  members: Member[],
): Promise<ResolutionOutcome> {
  const supabase = getServiceSupabase();
  const membersById = new Map(members.map((member) => [member.id, member]));
  const outcome: ResolutionOutcome = {
    resolved: new Map(),
    createdMembers: [],
    linkedNames: [],
    skippedNames: [],
    errors: [],
  };

  for (const item of unmatched) {
    const decision = resolutions[item.key];

    if (!decision || decision.action === "skip") {
      outcome.skippedNames.push(item.name);
      continue;
    }

    if (decision.action === "create") {
      const { data, error } = await supabase
        .from("members")
        .insert({ name: sanitizeAliasName(item.name) })
        .select("*")
        .single();

      if (error || !data) {
        outcome.errors.push(`${item.name}: could not create member (${error?.message ?? "unknown error"})`);
        continue;
      }

      outcome.resolved.set(item.key, data as Member);
      outcome.createdMembers.push((data as Member).name);
      continue;
    }

    const target = membersById.get(decision.memberId);

    if (!target) {
      outcome.errors.push(`${item.name}: selected member no longer exists`);
      continue;
    }

    const alias = sanitizeAliasName(item.name);
    const { error } = await supabase.from("member_aliases").upsert(
      {
        member_id: target.id,
        alias_name: alias,
        normalized_alias_name: normalizeAliasName(alias),
        source: "import_review",
      },
      { onConflict: "member_id,normalized_alias_name" },
    );

    if (error) {
      outcome.errors.push(`${item.name}: could not save alias (${error.message})`);
      continue;
    }

    outcome.resolved.set(item.key, target);
    outcome.linkedNames.push({ name: item.name, memberName: target.name });
  }

  return outcome;
}
