import { getServiceSupabase } from "../supabase/server";
import type { Member } from "../types";
import { normalizeImportKey } from "./import";
import { buildMemberNameResolver, loadMemberAliases } from "./member-aliases";
import {
  buildUnmatchedNames,
  resolveUnmatchedNames,
  type ImportPreview,
  type NameResolutions,
} from "./member-resolution";
import {
  parseTrafficLightPdfScoreReport,
  parseTrafficLightReport,
  parseTrafficLightXlsxReport,
  type ParsedTrafficLightScoreReport,
} from "./traffic-lights";

export type TrafficLightImportResult = {
  batchId: string | null;
  importedCount: number;
  skippedCount: number;
  /** Existing scores for the month that were replaced because the score changed. */
  overwrittenCount?: number;
  /** Existing scores for the month that were identical, so left alone. */
  unchangedCount?: number;
  createdMembers?: string[];
  linkedNames?: Array<{ name: string; memberName: string }>;
  skippedNames?: string[];
  errors: string[];
};

export type ScoreRowStatus = "new" | "overwrite" | "unchanged";

/** Same member + month already stored: overwrite when the score differs, otherwise leave it. */
export function classifyScoreRow(
  existing: { score: number; color: string } | undefined,
  row: { score: number; color: string },
): ScoreRowStatus {
  if (!existing) return "new";
  return existing.score === row.score && existing.color === row.color ? "unchanged" : "overwrite";
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

export function formatImportError(error: unknown): string {
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

async function createTrafficLightImportBatch(input: {
  filename: string;
  reportMonth: string;
  reportWindowStart: string;
  sourceType: "traffic_lights_pdf" | "traffic_lights_xlsx";
}) {
  const supabase = getServiceSupabase();
  const batchPayload = {
    filename: input.filename,
    report_date: input.reportMonth,
    source_type: input.sourceType,
    source_report_from: input.reportWindowStart,
    source_report_to: input.reportMonth,
    status: "pending",
  };
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert(batchPayload)
    .select("id")
    .single();

  if (batchError) {
    const message = formatImportError(batchError);

    if (input.sourceType === "traffic_lights_xlsx" && /source_type|constraint|check/i.test(message)) {
      const { data: fallbackBatch, error: fallbackBatchError } = await supabase
        .from("import_batches")
        .insert({
          ...batchPayload,
          source_type: "traffic_lights_pdf",
        })
        .select("id")
        .single();

      if (!fallbackBatchError) {
        return fallbackBatch;
      }

      throw fallbackBatchError;
    }

    throw batchError;
  }

  return batch;
}

async function loadMemberNameResolver(): Promise<(name: string) => Member[]> {
  const supabase = getServiceSupabase();
  const { data: existingMembers, error: membersError } = await supabase
    .from("members")
    .select("*");

  if (membersError) {
    throw membersError;
  }

  const aliases = await loadMemberAliases();
  return buildMemberNameResolver((existingMembers ?? []) as Member[], aliases);
}

export async function importTrafficLightReport(
  text: string,
  filename: string,
  reportMonthOverride?: string | null,
): Promise<TrafficLightImportResult> {
  const supabase = getServiceSupabase();
  const parsed = parseTrafficLightReport(text, normalizeReportMonth(reportMonthOverride ?? null));
  const errors: string[] = [];
  const batch = await createTrafficLightImportBatch({
    filename,
    reportMonth: parsed.reportMonth,
    reportWindowStart: parsed.reportWindowStart,
    sourceType: "traffic_lights_pdf",
  });

  let importedCount = 0;
  let skippedCount = 0;

  try {
    const resolveMemberName = await loadMemberNameResolver();

    const records = [];

    for (const row of parsed.rows) {
      const matches = resolveMemberName(row.name);

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
        report_window_start: parsed.reportWindowStart,
        report_window_end: parsed.reportWindowEnd,
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

type ScoreRow = ParsedTrafficLightScoreReport["rows"][number];

async function loadExistingScores(
  reportMonth: string,
  memberIds: string[],
): Promise<Map<string, { score: number; color: string }>> {
  const result = new Map<string, { score: number; color: string }>();

  if (memberIds.length === 0) {
    return result;
  }

  const { data, error } = await getServiceSupabase()
    .from("member_traffic_lights")
    .select("member_id, score, color")
    .eq("report_month", reportMonth)
    .in("member_id", memberIds);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as Array<{ member_id: string; score: number; color: string }>) {
    result.set(row.member_id, { score: row.score, color: row.color });
  }

  return result;
}

async function loadMembersAndResolver() {
  const { data, error } = await getServiceSupabase().from("members").select("*");

  if (error) {
    throw error;
  }

  const members = (data ?? []) as Member[];
  const aliases = await loadMemberAliases();
  return { members, resolve: buildMemberNameResolver(members, aliases) };
}

/** Dry run: nothing is written. Tells the user what the import would do. */
export async function previewTrafficLightScoreReport(
  parsed: ParsedTrafficLightScoreReport,
  filename: string,
): Promise<ImportPreview> {
  const { members, resolve } = await loadMembersAndResolver();
  const matched: Array<{ member: Member; row: ScoreRow }> = [];
  const unmatchedNames: string[] = [];
  let failed = 0;

  for (const row of parsed.rows) {
    const matches = resolve(row.name);

    if (matches.length === 0) {
      unmatchedNames.push(row.name);
    } else if (matches.length > 1) {
      failed += 1;
    } else {
      matched.push({ member: matches[0], row });
    }
  }

  const existing = await loadExistingScores(
    parsed.reportMonth,
    matched.map((item) => item.member.id),
  );
  const counts = { new: 0, overwrite: 0, unchanged: 0 };

  for (const item of matched) {
    counts[classifyScoreRow(existing.get(item.member.id), item.row)] += 1;
  }

  return {
    summary: {
      toImport: counts.new,
      toOverwrite: counts.overwrite,
      unchanged: counts.unchanged,
      needsDecision: unmatchedNames.length,
      failed,
    },
    files: [
      {
        label: filename,
        detail: `Report month ${parsed.reportMonth.slice(0, 7)}`,
        toImport: counts.new,
        toOverwrite: counts.overwrite,
        unchanged: counts.unchanged,
        needsDecision: unmatchedNames.length,
        error: null,
      },
    ],
    unmatched: buildUnmatchedNames(unmatchedNames, members),
    members: members.map((member) => ({ id: member.id, name: member.name })),
  };
}

async function importTrafficLightScoreReport(
  parsed: ParsedTrafficLightScoreReport,
  filename: string,
  sourceType: "traffic_lights_pdf" | "traffic_lights_xlsx",
  resolutions: NameResolutions = {},
): Promise<TrafficLightImportResult> {
  const supabase = getServiceSupabase();
  const errors: string[] = [];
  const batch = await createTrafficLightImportBatch({
    filename,
    reportMonth: parsed.reportMonth,
    reportWindowStart: parsed.reportWindowStart,
    sourceType,
  });

  let importedCount = 0;
  let overwrittenCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;

  try {
    const { members, resolve } = await loadMembersAndResolver();
    const matched: Array<{ member: Member; row: ScoreRow }> = [];
    const unmatched: Array<{ name: string; key: string; row: ScoreRow }> = [];

    for (const row of parsed.rows) {
      const matches = resolve(row.name);

      if (matches.length === 0) {
        unmatched.push({ name: row.name, key: normalizeImportKey(row.name), row });
      } else if (matches.length > 1) {
        skippedCount += 1;
        errors.push(`${row.name}: multiple members matched this name`);
      } else {
        matched.push({ member: matches[0], row });
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

    // One score per member per month: keep the first row if a file lists the same member twice.
    const seen = new Set<string>();
    const unique = matched.filter((item) => {
      if (seen.has(item.member.id)) {
        skippedCount += 1;
        errors.push(`${item.row.name}: duplicate row for ${item.member.name} in this file`);
        return false;
      }

      seen.add(item.member.id);
      return true;
    });

    const existing = await loadExistingScores(
      parsed.reportMonth,
      unique.map((item) => item.member.id),
    );
    const inserts = [];
    const overwrites = [];

    for (const item of unique) {
      const status = classifyScoreRow(existing.get(item.member.id), item.row);

      if (status === "unchanged") {
        unchangedCount += 1;
        skippedCount += 1;
      } else if (status === "overwrite") {
        overwrites.push(item);
      } else {
        inserts.push({
          member_id: item.member.id,
          report_month: parsed.reportMonth,
          report_window_start: parsed.reportWindowStart,
          report_window_end: parsed.reportWindowEnd,
          score: item.row.score,
          color: item.row.color,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          medical_count: 0,
          substitute_count: 0,
          referrals_given: 0,
          referrals_received: 0,
          visitors: 0,
          testimonials: 0,
          tyfcb: null,
          trainings: 0,
          week_count: 0,
          import_batch_id: batch.id,
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("member_traffic_lights").insert(inserts);

      if (error) {
        skippedCount += inserts.length;
        errors.push(formatImportError(error));
      } else {
        importedCount = inserts.length;
      }
    }

    for (const item of overwrites) {
      const { error } = await supabase
        .from("member_traffic_lights")
        .update({
          report_window_start: parsed.reportWindowStart,
          report_window_end: parsed.reportWindowEnd,
          score: item.row.score,
          color: item.row.color,
          import_batch_id: batch.id,
        })
        .eq("member_id", item.member.id)
        .eq("report_month", parsed.reportMonth);

      if (error) {
        skippedCount += 1;
        errors.push(`${item.row.name}: ${formatImportError(error)}`);
      } else {
        overwrittenCount += 1;
      }
    }

    await supabase
      .from("import_batches")
      .update({
        imported_count: importedCount + overwrittenCount,
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
      overwrittenCount,
      unchangedCount,
      createdMembers: outcome.createdMembers,
      linkedNames: outcome.linkedNames,
      skippedNames: outcome.skippedNames,
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

export async function importTrafficLightPdfScoreReport(
  text: string,
  filename: string,
  reportMonthOverride?: string | null,
  resolutions: NameResolutions = {},
): Promise<TrafficLightImportResult> {
  const parsed = parseTrafficLightPdfScoreReport(text, normalizeReportMonth(reportMonthOverride ?? null));
  return importTrafficLightScoreReport(parsed, filename, "traffic_lights_pdf", resolutions);
}

export async function previewTrafficLightPdfScoreReport(
  text: string,
  filename: string,
  reportMonthOverride?: string | null,
): Promise<ImportPreview> {
  const parsed = parseTrafficLightPdfScoreReport(text, normalizeReportMonth(reportMonthOverride ?? null));
  return previewTrafficLightScoreReport(parsed, filename);
}

export async function importTrafficLightXlsxReport(
  buffer: Buffer,
  filename: string,
  reportMonthOverride?: string | null,
  resolutions: NameResolutions = {},
): Promise<TrafficLightImportResult> {
  const parsed = parseTrafficLightXlsxReport(buffer, normalizeReportMonth(reportMonthOverride ?? null));
  return importTrafficLightScoreReport(parsed, filename, "traffic_lights_xlsx", resolutions);
}

export async function previewTrafficLightXlsxReport(
  buffer: Buffer,
  filename: string,
  reportMonthOverride?: string | null,
): Promise<ImportPreview> {
  const parsed = parseTrafficLightXlsxReport(buffer, normalizeReportMonth(reportMonthOverride ?? null));
  return previewTrafficLightScoreReport(parsed, filename);
}
