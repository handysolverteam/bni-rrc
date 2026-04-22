import { getServiceSupabase } from "../supabase/server";
import {
  getMissingPalmsMonths,
  isExactMonthlyPalmsWindow,
  type PalmsMonthlyCoverageEntry,
} from "./palms-monthly-performance";

export type PalmsMonthlyCoverage = {
  uploadedMonths: PalmsMonthlyCoverageEntry[];
  missingMonths: string[];
};

type ImportBatchCoverageRow = {
  filename: string;
  created_at: string;
  source_chapter_name: string | null;
  source_report_from: string | null;
  source_report_to: string | null;
};

export async function getPalmsMonthlyCoverage(): Promise<PalmsMonthlyCoverage> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("import_batches")
    .select("filename, created_at, source_chapter_name, source_report_from, source_report_to")
    .eq("source_type", "palms_chapter_summary")
    .eq("status", "completed")
    .order("source_report_from", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const deduped = new Map<string, PalmsMonthlyCoverageEntry>();

  for (const row of (data ?? []) as ImportBatchCoverageRow[]) {
    if (!row.source_report_from || !row.source_report_to) {
      continue;
    }

    if (
      !isExactMonthlyPalmsWindow({
        report_from: row.source_report_from,
        report_to: row.source_report_to,
      })
    ) {
      continue;
    }

    const key = `${row.source_chapter_name ?? "Unknown chapter"}|${row.source_report_from}|${row.source_report_to}`;

    if (!deduped.has(key)) {
      deduped.set(key, {
        chapterName: row.source_chapter_name,
        reportFrom: row.source_report_from,
        reportTo: row.source_report_to,
        filename: row.filename,
        createdAt: row.created_at,
      });
    }
  }

  const uploadedMonths = [...deduped.values()].sort((left, right) =>
    left.reportFrom.localeCompare(right.reportFrom),
  );

  return {
    uploadedMonths,
    missingMonths: getMissingPalmsMonths(uploadedMonths),
  };
}
