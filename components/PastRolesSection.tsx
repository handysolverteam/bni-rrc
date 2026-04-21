"use client";

import { startTransition, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ChapterRole, MemberPastRoleEntry } from "@/lib/types";

type PastRolesSectionProps = {
  memberId: string;
  availableRoles: ChapterRole[];
  pastRoles: MemberPastRoleEntry[];
};

async function readError(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === "string" ? payload.error : fallbackMessage;
}

export default function PastRolesSection({
  memberId,
  availableRoles,
  pastRoles,
}: PastRolesSectionProps) {
  const router = useRouter();
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setRoleDrafts(
      Object.fromEntries(availableRoles.map((role) => [role.id, role.name])),
    );
  }, [availableRoles]);

  const assignedRoleIds = useMemo(() => new Set(pastRoles.map((pastRole) => pastRole.role_id)), [pastRoles]);
  const addableRoles = useMemo(
    () => availableRoles.filter((role) => !assignedRoleIds.has(role.id)),
    [availableRoles, assignedRoleIds],
  );
  const filteredRoles = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();

    if (!query) {
      return availableRoles;
    }

    return availableRoles.filter((role) => role.name.toLowerCase().includes(query));
  }, [availableRoles, catalogSearch]);

  useEffect(() => {
    if (!newRoleId && addableRoles[0]) {
      setNewRoleId(addableRoles[0].id);
      return;
    }

    if (newRoleId && !addableRoles.some((role) => role.id === newRoleId)) {
      setNewRoleId(addableRoles[0]?.id ?? "");
    }
  }, [addableRoles, newRoleId]);

  function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function addPastRole() {
    if (!newRoleId) {
      return;
    }

    setBusyKey("add-past-role");
    setError(null);

    const response = await fetch(`/api/members/${memberId}/past-roles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: newRoleId }),
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to add role for this member."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  async function removePastRole(assignmentId: string) {
    setBusyKey(`remove-${assignmentId}`);
    setError(null);

    const response = await fetch(`/api/members/${memberId}/past-roles/${assignmentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to remove role from this member."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  async function movePastRole(assignmentId: string, direction: -1 | 1) {
    const currentIndex = pastRoles.findIndex((pastRole) => pastRole.id === assignmentId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= pastRoles.length) {
      return;
    }

    const reordered = [...pastRoles];
    const [movedRole] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, movedRole);

    setBusyKey(`reorder-${assignmentId}`);
    setError(null);

    const response = await fetch(`/api/members/${memberId}/past-roles/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_ids: reordered.map((pastRole) => pastRole.id) }),
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to reorder roles for this member."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  async function createCatalogRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newRoleName.trim()) {
      return;
    }

    setBusyKey("create-role");
    setError(null);

    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName }),
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to create role."));
      return;
    }

    setNewRoleName("");
    setBusyKey(null);
    refreshPage();
  }

  async function renameCatalogRole(roleId: string) {
    const draftName = roleDrafts[roleId] ?? "";

    setBusyKey(`rename-${roleId}`);
    setError(null);

    const response = await fetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draftName }),
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to rename role."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  async function deleteCatalogRole(roleId: string) {
    setBusyKey(`delete-${roleId}`);
    setError(null);

    const response = await fetch(`/api/roles/${roleId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setBusyKey(null);
      setError(await readError(response, "Unable to delete role."));
      return;
    }

    setBusyKey(null);
    refreshPage();
  }

  return (
    <section className="rounded-md border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-normal">Roles held</h2>
        <p className="text-sm text-[var(--muted)]">
          Add past chapter roles for this member and maintain the shared role catalog in one place.
        </p>
        {error ? <p className="text-sm text-[#c73b2f]">{error}</p> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Member past roles</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Reorder the list to control how these roles appear in achievements.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="focus-ring min-h-11 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                value={newRoleId}
                onChange={(event) => setNewRoleId(event.target.value)}
                disabled={addableRoles.length === 0 || busyKey === "add-past-role"}
              >
                {addableRoles.length === 0 ? (
                  <option value="">
                    {availableRoles.length === 0
                      ? "Create a shared role first"
                      : "All shared roles are already added"}
                  </option>
                ) : (
                  addableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={addPastRole}
                disabled={!newRoleId || busyKey === "add-past-role"}
              >
                Add role
              </button>
            </div>

            {pastRoles.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                No past roles added yet.
              </div>
            ) : (
              <div className="space-y-2">
                {pastRoles.map((pastRole, index) => (
                  <div
                    key={pastRole.id}
                    className="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{pastRole.role.name}</p>
                      <p className="text-sm text-[var(--muted)]">Display position {index + 1}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => movePastRole(pastRole.id, -1)}
                        disabled={index === 0 || busyKey === `reorder-${pastRole.id}`}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => movePastRole(pastRole.id, 1)}
                        disabled={index === pastRoles.length - 1 || busyKey === `reorder-${pastRole.id}`}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="focus-ring min-h-11 rounded-md border border-[#c73b2f] px-3 py-2 text-sm text-[#c73b2f] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => removePastRole(pastRole.id)}
                        disabled={busyKey === `remove-${pastRole.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Shared role catalog</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Shared roles can be reused across all members on the achievements screen.
              </p>
            </div>

            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createCatalogRole}>
              <input
                type="text"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Create a shared role"
                className="focus-ring min-h-11 flex-1 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="focus-ring min-h-11 rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!newRoleName.trim() || busyKey === "create-role"}
              >
                Create
              </button>
            </form>

            <input
              type="search"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Search shared roles"
              className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
            />

            <div className="space-y-2">
              {filteredRoles.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                  No shared roles match that search.
                </div>
              ) : (
                filteredRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex flex-col gap-2 rounded-md border border-[var(--line)] bg-white p-3"
                  >
                    <input
                      type="text"
                      value={roleDrafts[role.id] ?? role.name}
                      onChange={(event) =>
                        setRoleDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [role.id]: event.target.value,
                        }))
                      }
                      className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="focus-ring min-h-11 rounded-md border border-[var(--line)] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => renameCatalogRole(role.id)}
                        disabled={!roleDrafts[role.id]?.trim() || busyKey === `rename-${role.id}`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="focus-ring min-h-11 rounded-md border border-[#c73b2f] px-3 py-2 text-sm text-[#c73b2f] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => deleteCatalogRole(role.id)}
                        disabled={busyKey === `delete-${role.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
