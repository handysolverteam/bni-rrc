import { getServiceSupabase } from "../supabase/server";
import type { Member, MemberPalmsSnapshot } from "../types";
import { normalizeImportKey } from "./import";
import { loadMemberAliases, matchRowsByMemberName } from "./member-aliases";
import {
  buildUnmatchedNames,
  resolveUnmatchedNames,
  type ImportPreview,
  type NameResolutions,
} from "./member-resolution";
import {
  buildPalmsReportIdentity,
  parsePalmsChapterSummaryReport,
  type ParsedPalmsReport,
} from "./palms-import";
import { isExactMonthlyPalmsWindow } from "./palms-monthly-performance";

export type ImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  /** Stored figures replaced because the new report had different numbers. */
  overwrittenCount?: number;
  /** Rows identical to what is already stored, so left alone. */
  unchangedCount?: number;
  createdMembers?: string[];
  linkedNames?: Array<{ name: string; memberName: string }>;
  skippedNames?: string[];
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
  overwrittenCount: number;
  unchangedCount: number;
  createdMembers: string[];
  linkedNames: Array<{ name: string; memberName: string }>;
  skippedNames: string[];
  errors: string[];
};

export type PalmsBatchImportResult = {
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  failedFiles: number;
  importedCount: number;
  skippedCount: number;
  overwrittenCount: number;
  unchangedCount: number;
  createdMembers: string[];
  linkedNames: Array<{ name: string; memberName: string }>;
  skippedNames: string[];
  errors: string[];
  files: PalmsBatchFileResult[];
};

export type PalmsImportMode = "monthly" | "lifetime";

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
  return importParsedPalmsChapterSummaryReport(parsed, filename, "monthly");
}

export async function importLifetimePalmsChapterSummaryReport(
  xml: string,
  filename: string,
): Promise<ImportResult> {
  const parsed = parsePalmsChapterSummaryReport(xml);
  return importParsedPalmsChapterSummaryReport(parsed, filename, "lifetime");
}

export function validatePalmsReportWindow(parsed: ParsedPalmsReport, mode: PalmsImportMode): void {
  if (!parsed.reportTo) {
    throw new Error("PALMS report end date was not found.");
  }

  if (!parsed.reportFrom) {
    throw new Error("PALMS report start date was not found.");
  }

  const isMonthly = isExactMonthlyPalmsWindow({
    report_from: parsed.reportFrom,
    report_to: parsed.reportTo,
  });

  if (mode === "monthly" && !isMonthly) {
    throw new Error("This PALMS file is not a single calendar month.");
  }

  if (mode === "lifetime" && isMonthly) {
    throw new Error("This is a monthly PALMS file. Use the monthly PALMS upload instead.");
  }
}

type PalmsRow = ParsedPalmsReport["rows"][number];
type PalmsRecord = Omit<MemberPalmsSnapshot, "id">;

const PALMS_COMPARED_FIELDS = [
  "present_count",
  "absent_count",
  "late_count",
  "medical_count",
  "substitute_count",
  "referrals_given_inside",
  "referrals_given_outside",
  "referrals_received_inside",
  "referrals_received_outside",
  "visitors",
  "one_to_ones",
  "tyfcb",
  "ceu",
  "trainings",
] as const;

export type PalmsRowStatus = "new" | "overwrite" | "unchanged";

/** Same member + chapter + window already stored: overwrite when any figure differs. */
export function classifyPalmsRecord(
  existing: Partial<PalmsRecord> | undefined,
  record: PalmsRecord,
): PalmsRowStatus {
  if (!existing) return "new";

  const same = PALMS_COMPARED_FIELDS.every(
    (field) => Number(existing[field] ?? 0) === Number(record[field] ?? 0),
  );
  return same ? "unchanged" : "overwrite";
}

function buildPalmsRecord(
  parsed: ParsedPalmsReport,
  row: PalmsRow,
  memberId: string,
  reportFrom: string,
  reportTo: string,
  batchId: string | null,
): PalmsRecord {
  return {
    member_id: memberId,
    chapter_name: parsed.chapterName ?? "Unknown chapter",
    report_from: reportFrom,
    report_to: reportTo,
    run_at: parsed.runAt,
    present_count: row.presentCount,
    absent_count: row.absentCount,
    late_count: row.lateCount,
    medical_count: row.medicalCount,
    substitute_count: row.substituteCount,
    referrals_given_inside: row.referralsGivenInside,
    referrals_given_outside: row.referralsGivenOutside,
    referrals_received_inside: row.referralsReceivedInside,
    referrals_received_outside: row.referralsReceivedOutside,
    visitors: row.visitors,
    one_to_ones: row.oneToOnes,
    tyfcb: row.tyfcb,
    ceu: row.ceu,
    trainings: row.trainings,
    import_batch_id: batchId,
  };
}

async function loadExistingPalmsSnapshots(
  parsed: ParsedPalmsReport,
  reportFrom: string,
  reportTo: string,
): Promise<Map<string, MemberPalmsSnapshot>> {
  const { data, error } = await getServiceSupabase()
    .from("member_palms_snapshots")
    .select("*")
    .eq("chapter_name", parsed.chapterName ?? "Unknown chapter")
    .eq("report_from", reportFrom)
    .eq("report_to", reportTo);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as MemberPalmsSnapshot[]).map((row) => [row.member_id, row]));
}

async function loadMembersAndAliases() {
  const { data, error } = await getServiceSupabase().from("members").select("*");

  if (error) {
    throw error;
  }

  return { members: (data ?? []) as Member[], aliases: await loadMemberAliases() };
}

/** Dry run for one file: classifies every row without writing anything. */
async function previewParsedPalmsReport(
  parsed: ParsedPalmsReport,
  filename: string,
  mode: PalmsImportMode,
  members: Member[],
  aliases: Awaited<ReturnType<typeof loadMemberAliases>>,
) {
  validatePalmsReportWindow(parsed, mode);
  const reportFrom = parsed.reportFrom as string;
  const reportTo = parsed.reportTo as string;
  const matchedRows = matchRowsByMemberName(parsed.rows, members, aliases);
  const existing = await loadExistingPalmsSnapshots(parsed, reportFrom, reportTo);
  const counts = { new: 0, overwrite: 0, unchanged: 0 };
  const unmatchedNames: string[] = [];
  let failed = 0;

  for (const match of matchedRows) {
    if (match.matches.length === 0) {
      unmatchedNames.push(match.row.name);
    } else if (match.matches.length > 1) {
      failed += 1;
    } else {
      const record = buildPalmsRecord(parsed, match.row, match.matches[0].id, reportFrom, reportTo, null);
      counts[classifyPalmsRecord(existing.get(match.matches[0].id), record)] += 1;
    }
  }

  return {
    file: {
      label: filename,
      detail: `${parsed.chapterName ?? "Unknown chapter"} · ${reportFrom} to ${reportTo}`,
      toImport: counts.new,
      toOverwrite: counts.overwrite,
      unchanged: counts.unchanged,
      needsDecision: unmatchedNames.length,
      error: null as string | null,
    },
    unmatchedNames,
    failed,
  };
}

export async function previewPalmsChapterSummaryReports(
  files: Array<{ filename: string; xml: string }>,
  mode: PalmsImportMode,
): Promise<ImportPreview> {
  const { members, aliases } = await loadMembersAndAliases();
  const preview: ImportPreview = {
    summary: { toImport: 0, toOverwrite: 0, unchanged: 0, needsDecision: 0, failed: 0 },
    files: [],
    unmatched: [],
    members: members.map((member) => ({ id: member.id, name: member.name })),
  };
  const allUnmatched: string[] = [];

  for (const file of files) {
    try {
      const parsed = parsePalmsChapterSummaryReport(file.xml);
      const result = await previewParsedPalmsReport(parsed, file.filename, mode, members, aliases);
      preview.files.push(result.file);
      preview.summary.toImport += result.file.toImport;
      preview.summary.toOverwrite += result.file.toOverwrite;
      preview.summary.unchanged += result.file.unchanged;
      preview.summary.needsDecision += result.file.needsDecision;
      preview.summary.failed += result.failed;
      allUnmatched.push(...result.unmatchedNames);
    } catch (error) {
      preview.summary.failed += 1;
      preview.files.push({
        label: file.filename,
        detail: null,
        toImport: 0,
        toOverwrite: 0,
        unchanged: 0,
        needsDecision: 0,
        error: formatImportError(error),
      });
    }
  }

  preview.unmatched = buildUnmatchedNames(allUnmatched, members);
  return preview;
}

async function importParsedPalmsChapterSummaryReport(
  parsed: ParsedPalmsReport,
  filename: string,
  mode: PalmsImportMode,
  resolutions: NameResolutions = {},
): Promise<ImportResult> {
  const supabase = getServiceSupabase();
  validatePalmsReportWindow(parsed, mode);
  const reportFrom = parsed.reportFrom;
  const reportTo = parsed.reportTo;

  if (!reportFrom || !reportTo) {
    throw new Error("PALMS report window was not found.");
  }

  const reportIdentity = buildPalmsReportIdentity(parsed);
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      filename,
      report_date: reportTo,
      source_type: "palms_chapter_summary",
      source_chapter_name: parsed.chapterName ?? "Unknown chapter",
      source_report_from: reportFrom,
      source_report_to: reportTo,
      status: "pending",
    })
    .select("id")
    .single();

  if (batchError) {
    throw batchError;
  }

  let importedCount = 0;
  let overwrittenCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  try {
    const { members, aliases } = await loadMembersAndAliases();
    const matchedRows = matchRowsByMemberName(parsed.rows, members, aliases);
    const matched: Array<{ member: Member; row: PalmsRow }> = [];
    const unmatched: Array<{ key: string; name: string; row: PalmsRow }> = [];

    for (const match of matchedRows) {
      if (match.matches.length === 0) {
        unmatched.push({ key: normalizeImportKey(match.row.name), name: match.row.name, row: match.row });
      } else if (match.matches.length > 1) {
        skippedCount += 1;
        errors.push(`${match.row.name}: multiple members matched this name`);
      } else {
        matched.push({ member: match.matches[0], row: match.row });
      }
    }

    // Apply the user's create / link / skip decisions for names with no match.
    const outcome = await resolveUnmatchedNames(
      [...new Map(unmatched.map((item) => [item.key, { key: item.key, name: item.name }])).values()],
      resolutions,
      members,
    );
    errors.push(...outcome.errors);

    for (const item of unmatched) {
      const member = outcome.resolved.get(item.key);

      if (member) {
        matched.push({ member, row: item.row });
      } else {
        skippedCount += 1;
      }
    }

    const existing = await loadExistingPalmsSnapshots(parsed, reportFrom, reportTo);
    const seen = new Set<string>();
    const writes: PalmsRecord[] = [];

    for (const item of matched) {
      if (seen.has(item.member.id)) {
        skippedCount += 1;
        errors.push(`${item.row.name}: duplicate row for ${item.member.name} in this file`);
        continue;
      }

      seen.add(item.member.id);
      const record = buildPalmsRecord(parsed, item.row, item.member.id, reportFrom, reportTo, batch.id);
      const status = classifyPalmsRecord(existing.get(item.member.id), record);

      if (status === "unchanged") {
        unchangedCount += 1;
        skippedCount += 1;
      } else {
        writes.push(record);

        if (status === "overwrite") {
          overwrittenCount += 1;
        } else {
          importedCount += 1;
        }
      }
    }

    if (writes.length > 0) {
      const { error } = await supabase
        .from("member_palms_snapshots")
        .upsert(writes, { onConflict: "member_id,chapter_name,report_from,report_to" });

      if (error) {
        skippedCount += writes.length;
        importedCount = 0;
        overwrittenCount = 0;
        errors.push(formatImportError(error));
      }
    }

    // Nothing new or changed: this exact report is already stored. Keep the previous
    // "duplicate" bookkeeping so coverage and batch history read the same as before.
    const isDuplicate =
      importedCount === 0 && overwrittenCount === 0 && unchangedCount > 0 && errors.length === 0;

    await supabase
      .from("import_batches")
      .update({
        imported_count: importedCount + overwrittenCount,
        skipped_count: skippedCount,
        status: errors.length > 0 ? "failed" : "completed",
        error_message: isDuplicate
          ? `Duplicate PALMS report skipped for ${reportIdentity}`
          : errors.length > 0
            ? errors.join("\n")
            : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return {
      batchId: batch.id,
      importedCount,
      skippedCount,
      overwrittenCount,
      unchangedCount,
      createdMembers: outcome.createdMembers,
      linkedNames: outcome.linkedNames,
      skippedNames: outcome.skippedNames,
      errors: isDuplicate ? [`Already imported: ${reportIdentity}`] : errors,
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
  resolutions: NameResolutions = {},
): Promise<PalmsBatchImportResult> {
  return importPalmsChapterSummaryReportsByMode(files, "monthly", resolutions);
}

export async function importLifetimePalmsChapterSummaryReports(
  files: Array<{ filename: string; xml: string }>,
  resolutions: NameResolutions = {},
): Promise<PalmsBatchImportResult> {
  return importPalmsChapterSummaryReportsByMode(files, "lifetime", resolutions);
}

async function importPalmsChapterSummaryReportsByMode(
  files: Array<{ filename: string; xml: string }>,
  mode: PalmsImportMode,
  resolutions: NameResolutions,
): Promise<PalmsBatchImportResult> {
  const results: PalmsBatchFileResult[] = [];

  for (const file of files) {
    try {
      const parsed = parsePalmsChapterSummaryReport(file.xml);
      const reportIdentity = buildPalmsReportIdentity(parsed);
      const result = await importParsedPalmsChapterSummaryReport(parsed, file.filename, mode, resolutions);
      const isDuplicate =
        result.importedCount === 0 &&
        (result.overwrittenCount ?? 0) === 0 &&
        result.errors.some((error) => error.startsWith("Already imported:"));

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
        overwrittenCount: result.overwrittenCount ?? 0,
        unchangedCount: result.unchangedCount ?? 0,
        createdMembers: result.createdMembers ?? [],
        linkedNames: result.linkedNames ?? [],
        skippedNames: result.skippedNames ?? [],
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
        overwrittenCount: 0,
        unchangedCount: 0,
        createdMembers: [],
        linkedNames: [],
        skippedNames: [],
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
    overwrittenCount: results.reduce((sum, result) => sum + result.overwrittenCount, 0),
    unchangedCount: results.reduce((sum, result) => sum + result.unchangedCount, 0),
    createdMembers: results.flatMap((result) => result.createdMembers),
    linkedNames: results.flatMap((result) => result.linkedNames),
    skippedNames: [...new Set(results.flatMap((result) => result.skippedNames))],
    errors: results.flatMap((result) => result.errors),
    files: results,
  };
}
