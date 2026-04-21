import { getServiceSupabase } from "../supabase/server";
import type { Member, MemberPalmsSnapshot } from "../types";
import { matchPalmsRowMembers, parsePalmsChapterSummaryReport } from "./palms-import";

export type ImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

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

export async function importPalmsChapterSummaryReport(
  xml: string,
  filename: string,
): Promise<ImportResult> {
  const supabase = getServiceSupabase();
  const parsed = parsePalmsChapterSummaryReport(xml);

  if (!parsed.reportTo) {
    throw new Error("PALMS report end date was not found.");
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename,
      report_date: parsed.reportTo,
      status: "pending",
    })
    .select("id")
    .single();

  if (batchError) {
    throw batchError;
  }

  let importedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  try {
    const { data: existingMembers, error: membersError } = await supabase
      .from("members")
      .select("*");

    if (membersError) {
      throw membersError;
    }

    const matchedRows = matchPalmsRowMembers(parsed.rows, (existingMembers ?? []) as Member[]);
    const records: Omit<MemberPalmsSnapshot, "id">[] = [];

    for (const match of matchedRows) {
      if (match.matches.length === 0) {
        skippedCount += 1;
        errors.push(`${match.row.name}: member not found`);
        continue;
      }

      if (match.matches.length > 1) {
        skippedCount += 1;
        errors.push(`${match.row.name}: multiple members matched this name`);
        continue;
      }

      records.push({
        member_id: match.matches[0].id,
        chapter_name: parsed.chapterName ?? "Unknown chapter",
        report_from: parsed.reportFrom ?? parsed.reportTo,
        report_to: parsed.reportTo,
        run_at: parsed.runAt,
        present_count: match.row.presentCount,
        absent_count: match.row.absentCount,
        late_count: match.row.lateCount,
        medical_count: match.row.medicalCount,
        substitute_count: match.row.substituteCount,
        referrals_given_inside: match.row.referralsGivenInside,
        referrals_given_outside: match.row.referralsGivenOutside,
        referrals_received_inside: match.row.referralsReceivedInside,
        referrals_received_outside: match.row.referralsReceivedOutside,
        visitors: match.row.visitors,
        one_to_ones: match.row.oneToOnes,
        tyfcb: match.row.tyfcb,
        ceu: match.row.ceu,
        trainings: match.row.trainings,
        import_batch_id: batch.id,
      });
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from("member_palms_snapshots")
        .upsert(records, { onConflict: "member_id,chapter_name,report_from,report_to" });

      if (error) {
        skippedCount += records.length;
        importedCount = 0;
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
