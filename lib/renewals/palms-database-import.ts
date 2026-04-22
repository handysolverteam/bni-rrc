import { getServiceSupabase } from "../supabase/server";
import type { Member, MemberPalmsSnapshot } from "../types";
import {
  buildPalmsReportIdentity,
  matchPalmsRowMembers,
  parsePalmsChapterSummaryReport,
  type ParsedPalmsReport,
} from "./palms-import";

export type ImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

export type PalmsBatchFileResult = {
  filename: string;
  batchId: string | null;
  status: "imported" | "duplicate_skipped" | "failed";
  reportIdentity: string | null;
  chapterName: string | null;
  reportFrom: string | null;
  reportTo: string | null;
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

export type PalmsBatchImportResult = {
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  failedFiles: number;
  importedCount: number;
  skippedCount: number;
  errors: string[];
  files: PalmsBatchFileResult[];
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
  const parsed = parsePalmsChapterSummaryReport(xml);
  return importParsedPalmsChapterSummaryReport(parsed, filename);
}

async function importParsedPalmsChapterSummaryReport(
  parsed: ParsedPalmsReport,
  filename: string,
): Promise<ImportResult> {
  const supabase = getServiceSupabase();

  if (!parsed.reportTo) {
    throw new Error("PALMS report end date was not found.");
  }

  const reportIdentity = buildPalmsReportIdentity(parsed);
  const { data: existingSnapshots, error: existingSnapshotsError } = await supabase
    .from("member_palms_snapshots")
    .select("id")
    .eq("chapter_name", parsed.chapterName ?? "Unknown chapter")
    .eq("report_from", parsed.reportFrom ?? parsed.reportTo)
    .eq("report_to", parsed.reportTo)
    .limit(1);

  if (existingSnapshotsError) {
    throw existingSnapshotsError;
  }

  if ((existingSnapshots ?? []).length > 0) {
    const { data: duplicateBatch, error: duplicateBatchError } = await supabase
      .from("import_batches")
      .insert({
        filename,
        report_date: parsed.reportTo,
        source_type: "palms_chapter_summary",
        source_chapter_name: parsed.chapterName ?? "Unknown chapter",
        source_report_from: parsed.reportFrom ?? parsed.reportTo,
        source_report_to: parsed.reportTo,
        imported_count: 0,
        skipped_count: parsed.rows.length,
        status: "completed",
        error_message: `Duplicate PALMS report skipped for ${reportIdentity}`,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (duplicateBatchError) {
      throw duplicateBatchError;
    }

    return {
      batchId: duplicateBatch.id,
      importedCount: 0,
      skippedCount: parsed.rows.length,
      errors: [`Already imported: ${reportIdentity}`],
    };
  }

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename,
      report_date: parsed.reportTo,
      source_type: "palms_chapter_summary",
      source_chapter_name: parsed.chapterName ?? "Unknown chapter",
      source_report_from: parsed.reportFrom ?? parsed.reportTo,
      source_report_to: parsed.reportTo,
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

export async function importPalmsChapterSummaryReports(
  files: Array<{ filename: string; xml: string }>,
): Promise<PalmsBatchImportResult> {
  const results: PalmsBatchFileResult[] = [];

  for (const file of files) {
    try {
      const parsed = parsePalmsChapterSummaryReport(file.xml);
      const reportIdentity = buildPalmsReportIdentity(parsed);
      const result = await importParsedPalmsChapterSummaryReport(parsed, file.filename);
      const isDuplicate = result.importedCount === 0 && result.errors.some((error) => error.startsWith("Already imported:"));

      results.push({
        filename: file.filename,
        batchId: result.batchId,
        status: isDuplicate ? "duplicate_skipped" : "imported",
        reportIdentity,
        chapterName: parsed.chapterName,
        reportFrom: parsed.reportFrom,
        reportTo: parsed.reportTo,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        errors: result.errors,
      });
    } catch (error) {
      results.push({
        filename: file.filename,
        batchId: null,
        status: "failed",
        reportIdentity: null,
        chapterName: null,
        reportFrom: null,
        reportTo: null,
        importedCount: 0,
        skippedCount: 0,
        errors: [formatImportError(error)],
      });
    }
  }

  return {
    totalFiles: results.length,
    importedFiles: results.filter((result) => result.status === "imported").length,
    duplicateFiles: results.filter((result) => result.status === "duplicate_skipped").length,
    failedFiles: results.filter((result) => result.status === "failed").length,
    importedCount: results.reduce((sum, result) => sum + result.importedCount, 0),
    skippedCount: results.reduce((sum, result) => sum + result.skippedCount, 0),
    errors: results.flatMap((result) => result.errors),
    files: results,
  };
}
