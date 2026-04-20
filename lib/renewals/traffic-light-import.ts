import { getServiceSupabase } from "../supabase/server";
import type { Member } from "../types";
import { normalizeImportKey } from "./import";
import { parseTrafficLightReport } from "./traffic-lights";

export type TrafficLightImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

function memberNameKey(member: Pick<Member, "name">): string {
  return normalizeImportKey(member.name);
}

function normalizeReportMonth(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);

  if (!match) {
    throw new Error("Report month must be in YYYY-MM format.");
  }

  return `${match[1]}-${match[2]}-01`;
}

function formatImportError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; details?: unknown; hint?: unknown };
    return [maybeError.message, maybeError.details, maybeError.hint]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" ");
  }

  return "Import failed";
}

export async function importTrafficLightReport(
  text: string,
  filename: string,
  reportMonthOverride?: string | null,
): Promise<TrafficLightImportResult> {
  const supabase = getServiceSupabase();
  const parsed = parseTrafficLightReport(text, normalizeReportMonth(reportMonthOverride ?? null));
  const errors: string[] = [];

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename,
      report_date: parsed.reportMonth,
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

    const membersByName = new Map<string, Member[]>();

    for (const member of (existingMembers ?? []) as Member[]) {
      const key = memberNameKey(member);
      membersByName.set(key, [...(membersByName.get(key) ?? []), member]);
    }

    const records = [];

    for (const row of parsed.rows) {
      const matches = membersByName.get(normalizeImportKey(row.name)) ?? [];

      if (matches.length === 0) {
        skippedCount += 1;
        errors.push(`${row.name}: member not found`);
        continue;
      }

      if (matches.length > 1) {
        skippedCount += 1;
        errors.push(`${row.name}: multiple members matched this name`);
        continue;
      }

      records.push({
        member_id: matches[0].id,
        report_month: parsed.reportMonth,
        score: row.score,
        color: row.color,
        present_count: row.presentCount,
        absent_count: row.absentCount,
        late_count: row.lateCount,
        medical_count: row.medicalCount,
        substitute_count: row.substituteCount,
        referrals_given: row.referralsGiven,
        referrals_received: row.referralsReceived,
        visitors: row.visitors,
        testimonials: row.testimonials,
        tyfcb: row.tyfcb,
        trainings: row.trainings,
        week_count: row.weekCount,
        import_batch_id: batch.id,
      });
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from("member_traffic_lights")
        .upsert(records, { onConflict: "member_id,report_month" });

      if (error) {
        skippedCount += records.length;
        errors.push(formatImportError(error));
      } else {
        importedCount = records.length;
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
        error_message: formatImportError(error),
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    throw error;
  }
}
