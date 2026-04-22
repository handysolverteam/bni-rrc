"use client";

import type { DragEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { formatDisplayDate } from "@/lib/date-format";
import { parsePalmsChapterSummaryReport } from "@/lib/renewals/palms-import";

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

export default function ImportForm() {
  const palmsInputRef = useRef<HTMLInputElement | null>(null);
  const [queuedPalmsFiles, setQueuedPalmsFiles] = useState<QueuedPalmsFile[]>([]);
  const [palmsSubmitting, setPalmsSubmitting] = useState(false);
  const [palmsResult, setPalmsResult] = useState<PalmsBatchResult | null>(null);
  const [palmsError, setPalmsError] = useState<string | null>(null);
  const [duesSubmitting, setDuesSubmitting] = useState(false);
  const [duesResult, setDuesResult] = useState<ImportResult | null>(null);
  const [duesError, setDuesError] = useState<string | null>(null);
  const [trafficSubmitting, setTrafficSubmitting] = useState(false);
  const [trafficResult, setTrafficResult] = useState<ImportResult | null>(null);
  const [trafficError, setTrafficError] = useState<string | null>(null);

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
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            chapterName: parsed.chapterName,
            reportFrom: parsed.reportFrom,
            reportTo: parsed.reportTo,
            previewError: null,
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

  function removeQueuedPalmsFile(fileId: string) {
    setQueuedPalmsFiles((currentFiles) => currentFiles.filter((file) => file.id !== fileId));
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

  return (
    <div className="space-y-4">
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
          disabled={palmsSubmitting || queuedPalmsFiles.length === 0}
          type="submit"
        >
          {palmsSubmitting ? "Importing..." : "Import PALMS summaries"}
        </button>

        <PalmsImportFeedback result={palmsResult} error={palmsError} />
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
          <p className="text-sm font-semibold">Traffic lights PDF</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload the monthly Member Traffic Lights PDF. Month override is optional.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Traffic lights `.pdf`</span>
          <input
            className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2 text-sm"
            name="file"
            type="file"
            accept=".pdf"
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
