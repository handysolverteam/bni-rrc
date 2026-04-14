"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  errors: string[];
};

export default function ImportForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const response = await fetch("/api/import/membership-dues", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    setIsSubmitting(false);

    if (!response.ok) {
      setError(payload.error ?? "Import failed");
      return;
    }

    setResult(payload);
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border border-[var(--line)] bg-white p-4">
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
        className="focus-ring rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Importing..." : "Import report"}
      </button>

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
    </form>
  );
}
