"use client";

import { useMemo, useState } from "react";
import type {
  ImportPreview,
  NameResolution,
  NameResolutions,
} from "@/lib/renewals/member-resolution";

type Choice = "create" | "skip" | `link:${string}`;

function toResolution(choice: Choice): NameResolution {
  if (choice === "create") return { action: "create" };
  if (choice === "skip") return { action: "skip" };
  return { action: "link", memberId: choice.slice("link:".length) };
}

/**
 * Shown between "choose file" and the actual import. Lists what the import would do (new,
 * overwritten, already imported) and asks what to do with names that match no member:
 * create a new member, use an existing one (typo), or skip.
 */
export default function ImportReviewPanel({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: ImportPreview;
  onConfirm: (resolutions: NameResolutions) => Promise<void>;
  onCancel: () => void;
}) {
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(preview.unmatched.map((item) => [item.key, "create" as Choice])),
  );
  const [busy, setBusy] = useState(false);

  const sortedMembers = useMemo(
    () => [...preview.members].sort((left, right) => left.name.localeCompare(right.name)),
    [preview.members],
  );

  const picked = Object.values(choices);
  const createCount = picked.filter((choice) => choice === "create").length;
  const linkCount = picked.filter((choice) => choice.startsWith("link:")).length;
  const skipCount = picked.filter((choice) => choice === "skip").length;
  const { summary } = preview;
  const nothingToDo =
    summary.toImport + summary.toOverwrite + preview.unmatched.length === 0;

  async function confirm() {
    setBusy(true);
    const resolutions: NameResolutions = {};

    for (const item of preview.unmatched) {
      resolutions[item.key] = toResolution(choices[item.key] ?? "create");
    }

    await onConfirm(resolutions);
    setBusy(false);
  }

  return (
    <div className="space-y-4 rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4 text-sm">
      <p className="font-semibold">Review before importing</p>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="New entries to import" value={summary.toImport} />
        <Stat label="Existing entries to overwrite" value={summary.toOverwrite} />
        <Stat label="Already imported (will be skipped)" value={summary.unchanged} />
        <Stat label="Names needing your decision" value={summary.needsDecision} />
      </dl>
      {summary.failed > 0 ? (
        <p className="text-[var(--danger)]">
          {summary.failed} row(s)/file(s) cannot be imported (see details below).
        </p>
      ) : null}

      {preview.files.length > 1 || preview.files.some((file) => file.error) ? (
        <ul className="space-y-2">
          {preview.files.map((file) => (
            <li key={file.label} className="rounded-md border border-[var(--line)] bg-white p-3">
              <p className="font-medium">{file.label}</p>
              {file.detail ? <p className="text-[var(--muted)]">{file.detail}</p> : null}
              {file.error ? (
                <p className="text-[var(--danger)]">{file.error}</p>
              ) : (
                <p className="text-[var(--muted)]">
                  {file.toImport} new · {file.toOverwrite} overwrite · {file.unchanged} already
                  imported · {file.needsDecision} need a decision
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {preview.unmatched.length > 0 ? (
        <div className="space-y-3">
          <p className="font-medium">
            These names were not found in the members list. Choose what to do with each:
          </p>
          <ul className="space-y-3">
            {preview.unmatched.map((item) => {
              const suggestedIds = new Set(item.suggestions.map((suggestion) => suggestion.memberId));

              return (
                <li key={item.key} className="rounded-md border border-[var(--line)] bg-white p-3">
                  <p className="font-medium">{item.name}</p>
                  {item.suggestions.length > 0 ? (
                    <p className="text-[var(--muted)]">
                      Possible typo of: {item.suggestions.map((suggestion) => suggestion.name).join(", ")}
                    </p>
                  ) : null}
                  <select
                    aria-label={`What to do with ${item.name}`}
                    className="focus-ring mt-2 block w-full rounded-md border border-[var(--line)] p-2"
                    disabled={busy}
                    value={choices[item.key]}
                    onChange={(event) =>
                      setChoices((current) => ({ ...current, [item.key]: event.target.value as Choice }))
                    }
                  >
                    <option value="create">Create as a new member</option>
                    <option value="skip">Skip these rows</option>
                    {item.suggestions.length > 0 ? (
                      <optgroup label="Same person as (typo)">
                        {item.suggestions.map((suggestion) => (
                          <option key={suggestion.memberId} value={`link:${suggestion.memberId}`}>
                            Use existing: {suggestion.name} ({Math.round(suggestion.score * 100)}% match)
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    <optgroup label="Use another existing member">
                      {sortedMembers
                        .filter((member) => !suggestedIds.has(member.id))
                        .map((member) => (
                          <option key={member.id} value={`link:${member.id}`}>
                            Use existing: {member.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </li>
              );
            })}
          </ul>
          <p className="text-[var(--muted)]">
            Your choices: {createCount} new member(s) created, {linkCount} linked to an existing
            member (saved as an alias so next time it matches automatically), {skipCount} skipped.
          </p>
        </div>
      ) : null}

      {nothingToDo ? <p className="text-[var(--muted)]">There is nothing to import from this file.</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-60"
          disabled={busy || nothingToDo}
          onClick={confirm}
          type="button"
        >
          {busy ? "Importing..." : "Confirm import"}
        </button>
        <button
          className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-4 py-2 font-medium disabled:opacity-60"
          disabled={busy}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-3">
      <dd className="text-xl font-semibold">{value}</dd>
      <dt className="text-[var(--muted)]">{label}</dt>
    </div>
  );
}
