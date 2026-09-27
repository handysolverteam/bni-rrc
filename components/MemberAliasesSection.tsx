"use client";

import { startTransition, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/auth-token";
import type { MemberAlias } from "@/lib/types";

type MemberAliasesSectionProps = {
  memberId: string;
  aliases: MemberAlias[];
};

async function readError(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === "string" ? payload.error : fallbackMessage;
}

export default function MemberAliasesSection({
  memberId,
  aliases,
}: MemberAliasesSectionProps) {
  const router = useRouter();
  const [aliasName, setAliasName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function addAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!aliasName.trim()) {
      return;
    }

    setBusyKey("add-alias");
    setError(null);

    const response = await authedFetch(`/api/members/${memberId}/aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias_name: aliasName }),
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to add alias for this member."));
      return;
    }

    setAliasName("");
    setBusyKey(null);
    refreshPage();
  }

  async function removeAlias(aliasId: string) {
    setBusyKey(`remove-${aliasId}`);
    setError(null);

    const response = await authedFetch(`/api/members/${memberId}/aliases/${aliasId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to remove alias from this member."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-normal">Aliases</h2>
        <p className="text-sm text-[var(--muted)]">
          Older report spellings that should import into this member.
        </p>
        {error ? <p className="text-sm text-[#c73b2f]">{error}</p> : null}
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addAlias}>
        <input
          type="text"
          value={aliasName}
          onChange={(event) => setAliasName(event.target.value)}
          placeholder="Add alias"
          className="focus-ring min-h-11 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!aliasName.trim() || busyKey === "add-alias"}
        >
          Add alias
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {aliases.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--line)] bg-[#f7f7f4] p-4 text-sm text-[var(--muted)]">
            No aliases added yet.
          </div>
        ) : (
          aliases.map((alias) => (
            <div
              key={alias.id}
              className="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{alias.alias_name}</p>
                <p className="text-sm text-[var(--muted)]">{alias.source.replace("_", " ")}</p>
              </div>
              <button
                type="button"
                className="focus-ring min-h-11 rounded-md border border-[#c73b2f] px-3 py-2 text-sm text-[#c73b2f] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => removeAlias(alias.id)}
                disabled={busyKey === `remove-${alias.id}`}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
