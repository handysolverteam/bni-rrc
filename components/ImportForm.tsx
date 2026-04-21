"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

export default function ImportForm() {
  const [palmsSubmitting, setPalmsSubmitting] = useState(false);
  const [palmsResult, setPalmsResult] = useState<ImportResult | null>(null);
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

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) =>
          submitImport(
            event,
            "/api/import/palms",
            setPalmsSubmitting,
            setPalmsResult,
            setPalmsError,
          )
        }
        className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4"
      >
        <div>
          <p className="text-sm font-semibold">PALMS chapter summary `.xls`</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Upload the cumulative chapter summary report to populate lifetime member achievements.
          </p>
        </div>
        <label className="block">
          <span className="text-sm font-medium">PALMS report `.xls`</span>
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
          disabled={palmsSubmitting}
          type="submit"
        >
          {palmsSubmitting ? "Importing..." : "Import PALMS summary"}
        </button>

        <ImportFeedback result={palmsResult} error={palmsError} />
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
