"use client";

import type { DragEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDisplayDate, formatDisplayMonth } from "@/lib/date-format";
import type { PalmsMonthlyCoverage } from "@/lib/renewals/import-coverage";
import { parsePalmsChapterSummaryReport } from "@/lib/renewals/palms-import";
import { isExactMonthlyPalmsWindow } from "@/lib/renewals/palms-monthly-performance";

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

type PalmsBatchResult = ImportResult & {
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  failedFiles: number;
  files: Array<{
    filename: string;
    status: "imported" | "duplicate_skipped" | "failed";
    reportIdentity: string | null;
    chapterName: string | null;
    reportFrom: string | null;
    reportTo: string | null;
    importedCount: number;
    skippedCount: number;
    errors: string[];
  }>;
};

type QueuedPalmsFile = {
  id: string;
  file: File;
  chapterName: string | null;
  reportFrom: string | null;
  reportTo: string | null;
  previewError: string | null;
};

export default function ImportForm({ coverage }: { coverage: PalmsMonthlyCoverage }) {
  const router = useRouter();
  const palmsInputRef = useRef<HTMLInputElement | null>(null);
  const lifetimePalmsInputRef = useRef<HTMLInputElement | null>(null);
  const [queuedPalmsFiles, setQueuedPalmsFiles] = useState<QueuedPalmsFile[]>([]);
  const [palmsSubmitting, setPalmsSubmitting] = useState(false);
  const [palmsResult, setPalmsResult] = useState<PalmsBatchResult | null>(null);
  const [palmsError, setPalmsError] = useState<string | null>(null);
  const [queuedLifetimePalmsFiles, setQueuedLifetimePalmsFiles] = useState<QueuedPalmsFile[]>([]);
  const [lifetimePalmsSubmitting, setLifetimePalmsSubmitting] = useState(false);
  const [lifetimePalmsResult, setLifetimePalmsResult] = useState<PalmsBatchResult | null>(null);
  const [lifetimePalmsError, setLifetimePalmsError] = useState<string | null>(null);
  const [duesSubmitting, setDuesSubmitting] = useState(false);
  const [duesResult, setDuesResult] = useState<ImportResult | null>(null);
  const [duesError, setDuesError] = useState<string | null>(null);
  const [trafficSubmitting, setTrafficSubmitting] = useState(false);
  const [trafficResult, setTrafficResult] = useState<ImportResult | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);
  const [sponsorSubmitting, setSponsorSubmitting] = useState(false);
  const [sponsorResult, setSponsorResult] = useState<ImportResult | null>(null);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [trainingSubmitting, setTrainingSubmitting] = useState(false);
  const [trainingResult, setTrainingResult] = useState<ImportResult | null>(null);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  function hasInvalidPalmsFiles(files: QueuedPalmsFile[]): boolean {
    return files.some((file) => file.previewError !== null);
  }

  async function submitImport(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    setSubmitting: (value: boolean) => void,
    setResult: (value: ImportResult | null) => void,
    setError: (value: string | null) => void,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setSubmitting(true);
    setError(null);
    setResult(null);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Import failed");
      return;
    }

    setResult(payload);
    form.reset();
  }

  async function queuePalmsFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    const nextQueued = await Promise.all(
      nextFiles.map(async (file) => {
        try {
          const parsed = parsePalmsChapterSummaryReport(await file.text());
          const isMonthly =
            parsed.reportFrom && parsed.reportTo
              ? isExactMonthlyPalmsWindow({
                  report_from: parsed.reportFrom,
                  report_to: parsed.reportTo,
                })
              : false;

          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            chapterName: parsed.chapterName,
            reportFrom: parsed.reportFrom,
            reportTo: parsed.reportTo,
            previewError: isMonthly ? null : "This PALMS file is not a single calendar month.",
          } satisfies QueuedPalmsFile;
        } catch (error) {
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            chapterName: null,
            reportFrom: null,
            reportTo: null,
            previewError: error instanceof Error ? error.message : "Preview failed",
          } satisfies QueuedPalmsFile;
        }
      }),
    );

    setQueuedPalmsFiles((currentFiles) => {
      const byId = new Map(currentFiles.map((item) => [item.id, item]));

      for (const file of nextQueued) {
        byId.set(file.id, file);
      }

      return [...byId.values()];
    });
  }

  async function queueLifetimePalmsFiles(files: FileList | File[]) {
    const nextFiles = Array.from(files);
    const nextQueued = await Promise.all(
      nextFiles.map(async (file) => {
        try {
          const parsed = parsePalmsChapterSummaryReport(await file.text());
          const isMonthly =
            parsed.reportFrom && parsed.reportTo
              ? isExactMonthlyPalmsWindow({
                  report_from: parsed.reportFrom,
                  report_to: parsed.reportTo,
                })
              : false;

          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            chapterName: parsed.chapterName,
            reportFrom: parsed.reportFrom,
            reportTo: parsed.reportTo,
            previewError: isMonthly
              ? "This is a monthly PALMS file. Use the monthly PALMS upload instead."
              : null,
          } satisfies QueuedPalmsFile;
        } catch (error) {
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            chapterName: null,
            reportFrom: null,
            reportTo: null,
            previewError: error instanceof Error ? error.message : "Preview failed",
          } satisfies QueuedPalmsFile;
        }
      }),
    );

    setQueuedLifetimePalmsFiles((currentFiles) => {
      const byId = new Map(currentFiles.map((item) => [item.id, item]));

      for (const file of nextQueued) {
        byId.set(file.id, file);
      }

      return [...byId.values()];
    });
  }

  function removeQueuedPalmsFile(fileId: string) {
    setQueuedPalmsFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }

  function removeQueuedLifetimePalmsFile(fileId: string) {
    setQueuedLifetimePalmsFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
  }

  async function submitPalmsImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPalmsSubmitting(true);
    setPalmsError(null);
    setPalmsResult(null);

    if (queuedPalmsFiles.length === 0) {
      setPalmsSubmitting(false);
      setPalmsError("Select one or more PALMS .xls files first.");
      return;
    }

    if (hasInvalidPalmsFiles(queuedPalmsFiles)) {
      setPalmsSubmitting(false);
      setPalmsError("Remove invalid PALMS files before importing.");
      return;
    }

    const formData = new FormData();

    for (const item of queuedPalmsFiles) {
      formData.append("files", item.file);
    }

    const response = await fetch("/api/import/palms", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setPalmsSubmitting(false);

    if (!response.ok) {
      setPalmsError(payload.error ?? "Import failed");
      return;
    }

    setPalmsResult(payload);
    setQueuedPalmsFiles([]);
    router.refresh();

    if (palmsInputRef.current) {
      palmsInputRef.current.value = "";
    }
  }

  async function handlePalmsDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      await queuePalmsFiles(event.dataTransfer.files);
    }
  }

  async function submitLifetimePalmsImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLifetimePalmsSubmitting(true);
    setLifetimePalmsError(null);
    setLifetimePalmsResult(null);

    if (queuedLifetimePalmsFiles.length === 0) {
      setLifetimePalmsSubmitting(false);
      setLifetimePalmsError("Select one or more PALMS .xls files first.");
      return;
    }

    if (hasInvalidPalmsFiles(queuedLifetimePalmsFiles)) {
      setLifetimePalmsSubmitting(false);
      setLifetimePalmsError("Remove invalid PALMS files before importing.");
      return;
    }

    const formData = new FormData();

    for (const item of queuedLifetimePalmsFiles) {
      formData.append("files", item.file);
    }

    const response = await fetch("/api/import/palms-lifetime", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setLifetimePalmsSubmitting(false);

    if (!response.ok) {
      setLifetimePalmsError(payload.error ?? "Import failed");
      return;
    }

    setLifetimePalmsResult(payload);
    setQueuedLifetimePalmsFiles([]);
    router.refresh();

    if (lifetimePalmsInputRef.current) {
      lifetimePalmsInputRef.current.value = "";
    }
  }

  async function handleLifetimePalmsDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) {
      await queueLifetimePalmsFiles(event.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={submitLifetimePalmsImport}
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">PALMS lifetime chapter summary `.xls`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload broad PALMS chapter summaries for lifetime achievements. Monthly PALMS files
            should stay in the monthly upload below.
          </p>
        </div>
        <label
          className="block rounded-md border border-dashed border-[var(--line)] bg-[#f7f7f4] p-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleLifetimePalmsDrop}
        >
          <span className="text-sm font-medium">Lifetime PALMS reports `.xls`</span>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Drop broad date-range files here or browse to select many at once.
          </p>
          <input
            ref={lifetimePalmsInputRef}
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="files"
            type="file"
            accept=".xls"
            multiple
            onChange={(event) => {
              if (event.target.files) {
                void queueLifetimePalmsFiles(event.target.files);
              }
            }}
          />
        </label>
        {queuedLifetimePalmsFiles.length > 0 ? (
          <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3 text-sm">
            <p className="font-semibold">Queued lifetime PALMS files</p>
            <ul className="mt-3 space-y-3">
              {queuedLifetimePalmsFiles.map((item) => (
                <li key={item.id} className="rounded-md border border-[var(--line)] bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{item.file.name}</p>
                      {item.previewError ? (
                        <p className="mt-1 text-[var(--danger)]">{item.previewError}</p>
                      ) : (
                        <p className="mt-1 text-[var(--muted)]">
                          {item.chapterName ?? "Unknown chapter"} | {formatDisplayDate(item.reportFrom)} to{" "}
                          {formatDisplayDate(item.reportTo)}
                        </p>
                      )}
                    </div>
                    <button
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                      type="button"
                      onClick={() => removeQueuedLifetimePalmsFile(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={
            lifetimePalmsSubmitting ||
            queuedLifetimePalmsFiles.length === 0 ||
            hasInvalidPalmsFiles(queuedLifetimePalmsFiles)
          }
          type="submit"
        >
          {lifetimePalmsSubmitting ? "Importing..." : "Import lifetime PALMS summary"}
        </button>

        <PalmsImportFeedback result={lifetimePalmsResult} error={lifetimePalmsError} />
      </form>

      <form
        onSubmit={submitPalmsImport}
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">PALMS monthly chapter summaries `.xls`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Drag and drop one or many monthly PALMS chapter summaries. Duplicate monthly reports are
            skipped automatically, and this upload stays separate from PDF-based imports.
          </p>
        </div>
        <label
          className="block rounded-md border border-dashed border-[var(--line)] bg-[#f7f7f4] p-4"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handlePalmsDrop}
        >
          <span className="text-sm font-medium">PALMS reports `.xls`</span>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Drop files here or browse to select many at once.
          </p>
          <input
            ref={palmsInputRef}
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="files"
            type="file"
            accept=".xls"
            multiple
            onChange={(event) => {
              if (event.target.files) {
                void queuePalmsFiles(event.target.files);
              }
            }}
          />
        </label>
        {queuedPalmsFiles.length > 0 ? (
          <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3 text-sm">
            <p className="font-semibold">Queued PALMS files</p>
            <ul className="mt-3 space-y-3">
              {queuedPalmsFiles.map((item) => (
                <li key={item.id} className="rounded-md border border-[var(--line)] bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{item.file.name}</p>
                      {item.previewError ? (
                        <p className="mt-1 text-[var(--danger)]">{item.previewError}</p>
                      ) : (
                        <p className="mt-1 text-[var(--muted)]">
                          {item.chapterName ?? "Unknown chapter"} | {formatDisplayDate(item.reportFrom)} to{" "}
                          {formatDisplayDate(item.reportTo)}
                        </p>
                      )}
                    </div>
                    <button
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                      type="button"
                      onClick={() => removeQueuedPalmsFile(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={
            palmsSubmitting || queuedPalmsFiles.length === 0 || hasInvalidPalmsFiles(queuedPalmsFiles)
          }
          type="submit"
        >
          {palmsSubmitting ? "Importing..." : "Import PALMS summaries"}
        </button>

        <PalmsImportFeedback result={palmsResult} error={palmsError} />
      </form>

      <PalmsCoverageSection coverage={coverage} />

      <form
        onSubmit={(event) =>
          submitImport(
            event,
            "/api/import/trainings",
            setTrainingSubmitting,
            setTrainingResult,
            setTrainingError,
          )
        }
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">BNI member training report `.xls`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload the chapter member training report to track lifetime and past-year training
            attendance counts on member achievement pages.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Training report `.xls`</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="file"
            type="file"
            accept=".xls"
            required
          />
        </label>
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={trainingSubmitting}
          type="submit"
        >
          {trainingSubmitting ? "Importing..." : "Import training report"}
        </button>

        <ImportFeedback result={trainingResult} error={trainingError} />
      </form>

      <form
        onSubmit={(event) =>
          submitImport(
            event,
            "/api/import/sponsors",
            setSponsorSubmitting,
            setSponsorResult,
            setSponsorError,
          )
        }
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">Sponsor report `.xls`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload the chapter sponsor report to refresh lifetime and past-year sponsor
            achievements for imported members.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Sponsor report `.xls`</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="file"
            type="file"
            accept=".xls"
            required
          />
        </label>
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={sponsorSubmitting}
          type="submit"
        >
          {sponsorSubmitting ? "Importing..." : "Import sponsor report"}
        </button>

        <ImportFeedback result={sponsorResult} error={sponsorError} />
      </form>

      <form
        onSubmit={(event) =>
          submitImport(
            event,
            "/api/import/membership-dues",
            setDuesSubmitting,
            setDuesResult,
            setDuesError,
          )
        }
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <label className="block">
          <span className="text-sm font-medium">Dues report `.xls`</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="file"
            type="file"
            accept=".xls"
            required
          />
        </label>
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={duesSubmitting}
          type="submit"
        >
          {duesSubmitting ? "Importing..." : "Import dues report"}
        </button>

        <ImportFeedback result={duesResult} error={duesError} />
      </form>

      <form
        onSubmit={(event) =>
          submitImport(
            event,
            "/api/import/traffic-lights",
            setTrafficSubmitting,
            setTrafficResult,
            setTrafficError,
          )
        }
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">Traffic lights `.pdf` or `.xlsx`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload the monthly Member Traffic Lights PDF or score-only XLSX. Month override is optional.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Traffic lights `.pdf` or `.xlsx`</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="file"
            type="file"
            accept=".pdf,.xlsx"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Report month</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="reportMonth"
            type="month"
          />
        </label>
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={trafficSubmitting}
          type="submit"
        >
          {trafficSubmitting ? "Importing..." : "Import traffic lights"}
        </button>

        <ImportFeedback result={trafficResult} error={trafficError} />
      </form>
    </div>
  );
}

function PalmsCoverageSection({ coverage }: { coverage: PalmsMonthlyCoverage }) {
  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-4">
      <div>
        <p className="text-sm font-semibold">Monthly PALMS coverage</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Uploaded months appear here so missing months can be backfilled individually.
        </p>
      </div>

      {coverage.uploadedMonths.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Uploaded</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {coverage.uploadedMonths.map((month) => (
              <li
                key={`${month.chapterName ?? "chapter"}-${month.reportFrom}-${month.reportTo}`}
                className="rounded-full border border-[var(--line)] bg-[#f7f7f4] px-3 py-1 text-sm"
              >
                {formatDisplayMonth(month.reportFrom)}
              </li>
            ))}
          </ul>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">Chapter</th>
                  <th className="py-2 pr-3 font-medium">Filename</th>
                  <th className="py-2 pr-3 font-medium">Imported on</th>
                </tr>
              </thead>
              <tbody>
                {coverage.uploadedMonths.map((month) => (
                  <tr
                    key={`${month.chapterName ?? "chapter"}-${month.reportFrom}-${month.reportTo}-row`}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-2 pr-3">{formatDisplayMonth(month.reportFrom)}</td>
                    <td className="py-2 pr-3">{month.chapterName ?? "Unknown chapter"}</td>
                    <td className="py-2 pr-3">{month.filename ?? "-"}</td>
                    <td className="py-2 pr-3">{formatDisplayDate(month.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">No monthly PALMS files have been uploaded yet.</p>
      )}

      <div className="mt-4">
        <p className="text-sm font-medium">Missing</p>
        {coverage.missingMonths.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {coverage.missingMonths.map((month) => (
              <li
                key={month}
                className="rounded-full border border-[#d88b86] bg-[#fff4f3] px-3 py-1 text-sm text-[#a13c34]"
              >
                {formatDisplayMonth(month)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No missing months detected in the current uploaded range.</p>
        )}
      </div>
    </section>
  );
}

function ImportFeedback({ result, error }: { result: ImportResult | null; error: string | null }) {
  return (
    <>
      {result ? (
        <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3 text-sm">
          <p className="font-semibold">Import complete</p>
          <p>Imported: {result.importedCount}</p>
          <p>Skipped: {result.skippedCount}</p>
          {result.errors.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-[var(--danger)]">
              {result.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-[var(--danger)] bg-white p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
    </>
  );
}

function PalmsImportFeedback({
  result,
  error,
}: {
  result: PalmsBatchResult | null;
  error: string | null;
}) {
  return (
    <>
      {result ? (
        <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3 text-sm">
          <p className="font-semibold">PALMS batch import complete</p>
          <p>Files received: {result.totalFiles}</p>
          <p>Imported files: {result.importedFiles}</p>
          <p>Duplicate files skipped: {result.duplicateFiles}</p>
          <p>Failed files: {result.failedFiles}</p>
          <p>Imported rows: {result.importedCount}</p>
          <p>Skipped rows: {result.skippedCount}</p>
          <ul className="mt-3 space-y-2">
            {result.files.map((file) => (
              <li key={`${file.filename}-${file.reportIdentity ?? file.status}`} className="rounded-md border border-[var(--line)] bg-white p-3">
                <p className="font-medium">{file.filename}</p>
                <p className="mt-1 text-[var(--muted)]">
                  {file.status === "imported"
                    ? "Imported"
                    : file.status === "duplicate_skipped"
                      ? "Already imported"
                      : "Failed"}
                  {file.reportFrom || file.reportTo
                    ? ` | ${formatDisplayDate(file.reportFrom)} to ${formatDisplayDate(file.reportTo)}`
                    : ""}
                </p>
                {file.errors.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-[var(--danger)]">
                    {file.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-[var(--danger)] bg-white p-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
    </>
  );
}
