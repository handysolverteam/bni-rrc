import { getServiceSupabase } from "../supabase/server";
import type { ImportMemberRow, Member, RenewalCycle } from "../types";
import { normalizeImportKey, parseMembershipDuesReport } from "./import";

export type ImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

function renewalYearFromDate(date: string): number {
  return Number(date.slice(0, 4));
}

function memberKey(member: Pick<Member, "name" | "industry">): string {
  return `${normalizeImportKey(member.name)}|${normalizeImportKey(member.industry ?? "")}`;
}

export async function importMembershipDuesReport(
  xml: string,
  filename: string,
): Promise<ImportResult> {
  const supabase = getServiceSupabase();
  const parsed = parseMembershipDuesReport(xml);
  const errors: string[] = [];

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename,
      report_date: parsed.reportDate,
      status: "pending",
    })
    .select("id")
    .single();

  if (batchError) {
    throw batchError;
  }

  let importedCount = 0;
  let skippedCount = 0;

  try {
    const { data: existingMembers, error: membersError } = await supabase
      .from("members")
      .select("*");

    if (membersError) {
      throw membersError;
    }

    const membersByKey = new Map(
      ((existingMembers ?? []) as Member[]).map((member) => [memberKey(member), member]),
    );

    for (const row of parsed.rows) {
      try {
        const member = await upsertMember(row, membersByKey);
        await upsertRenewalCycle(member.id, row);
        importedCount += 1;
      } catch (error) {
        skippedCount += 1;
        errors.push(`${row.name}: ${error instanceof Error ? error.message : "Import failed"}`);
      }
    }

    await supabase
      .from("import_batches")
      .update({
        imported_count: importedCount,
        skipped_count: skippedCount,
        status: errors.length > 0 ? "failed" : "completed",
        error_message: errors.length > 0 ? errors.join("\n") : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return {
      batchId: batch.id,
      importedCount,
      skippedCount,
      errors,
    };
  } catch (error) {
    await supabase
      .from("import_batches")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Import failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    throw error;
  }
}

async function upsertMember(
  row: ImportMemberRow,
  membersByKey: Map<string, Member>,
): Promise<Member> {
  const supabase = getServiceSupabase();
  const key = `${normalizeImportKey(row.name)}|${normalizeImportKey(row.industry)}`;
  const existing = membersByKey.get(key);

  if (existing) {
    const { data, error } = await supabase
      .from("members")
      .update({
        name: row.name.trim(),
        industry: row.industry.trim(),
        report_role: row.reportRole,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    membersByKey.set(key, data as Member);
    return data as Member;
  }

  const { data, error } = await supabase
    .from("members")
    .insert({
      name: row.name.trim(),
      industry: row.industry.trim(),
      report_role: row.reportRole,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  membersByKey.set(key, data as Member);
  return data as Member;
}

async function upsertRenewalCycle(memberId: string, row: ImportMemberRow): Promise<RenewalCycle> {
  const supabase = getServiceSupabase();
  const renewalYear = renewalYearFromDate(row.dueDate);
  const { data: existing, error: selectError } = await supabase
    .from("renewal_cycles")
    .select("*")
    .eq("member_id", memberId)
    .eq("renewal_year", renewalYear)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("renewal_cycles")
      .update({
        renewal_date: row.dueDate,
        source_membership_status: row.membershipStatus,
        auto_renewal_enabled: row.autoRenewalEnabled,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data as RenewalCycle;
  }

  const { data, error } = await supabase
    .from("renewal_cycles")
    .insert({
      member_id: memberId,
      renewal_year: renewalYear,
      renewal_date: row.dueDate,
      source_membership_status: row.membershipStatus,
      auto_renewal_enabled: row.autoRenewalEnabled,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as RenewalCycle;
}
