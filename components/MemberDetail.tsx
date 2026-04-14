"use client";

import { useRouter } from "next/navigation";
import type { DashboardCycle, Member } from "@/lib/types";
import TaskList from "./TaskList";

type MemberDetailPayload = {
  member: Member;
  currentCycle: DashboardCycle | null;
  cycles: DashboardCycle[];
};

const checklistItems = [
  ["online_form_filled", "Online form filled"],
  ["checklist_filled", "Checklist filled"],
  ["payment_link_generated", "Payment link generated"],
  ["payment_made", "Payment made"],
] as const;

export default function MemberDetail({
  detail,
  committeeMembers,
}: {
  detail: MemberDetailPayload;
  committeeMembers: Member[];
}) {
  const router = useRouter();
  const cycle = detail.currentCycle;

  async function updateCycle(payload: Record<string, unknown>) {
    if (!cycle) {
      return;
    }

    await fetch(`/api/renewal-cycles/${cycle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    router.refresh();
  }

  if (!cycle) {
    return (
      <div className="rounded-md border border-[var(--line)] bg-white p-4">
        <h1 className="text-2xl font-semibold">{detail.member.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">No renewal cycles have been imported yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">{cycle.stage}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">{detail.member.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.industry}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.report_role}</p>
          </div>
          <select
            className="focus-ring rounded-md border border-[var(--line)] p-2 text-sm"
            defaultValue={cycle.status}
            onChange={(event) => updateCycle({ status: event.target.value })}
          >
            <option value="active">Active</option>
            <option value="renewed">Renewed</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Checklist</h2>
          <div className="mt-4 space-y-3">
            {checklistItems.map(([field, label]) => {
              const dateField = `${field}_date` as keyof DashboardCycle;
              return (
                <label key={field} className="flex items-start gap-3 rounded-md border border-[var(--line)] p-3">
                  <input
                    className="mt-1"
                    checked={Boolean(cycle[field])}
                    type="checkbox"
                    onChange={(event) => updateCycle({ [field]: event.target.checked })}
                  />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {cycle[dateField] ? `Completed ${cycle[dateField]}` : "Pending"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Follow-up</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Last follow-up
              <input
                className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] p-2"
                defaultValue={cycle.last_followup_date ?? ""}
                type="date"
                onBlur={(event) => updateCycle({ last_followup_date: event.target.value || null })}
              />
            </label>
            <label className="text-sm">
              Next follow-up
              <input
                className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] p-2"
                defaultValue={cycle.next_followup_date ?? ""}
                type="date"
                onBlur={(event) => updateCycle({ next_followup_date: event.target.value || null })}
              />
            </label>
          </div>

          <h3 className="mt-5 font-semibold">Committee assignees</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[1, 2].map((slot) => {
              const selected = cycle.assignments.find((assignment) => assignment.slot === slot);
              return (
                <label key={slot} className="text-sm">
                  Slot {slot}
                  <select
                    className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] p-2"
                    defaultValue={selected?.assignee_member_id ?? ""}
                    onChange={(event) =>
                      updateCycle({
                        assignments: [
                          {
                            slot,
                            assignee_member_id: event.target.value || null,
                          },
                        ],
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {committeeMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Renewal dates</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(cycle.derived_dates).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{label.replaceAll("_", " ")}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <TaskList tasks={cycle.renewal_tasks ?? []} />
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <h2 className="text-xl font-semibold tracking-normal">Renewal history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {detail.cycles.map((item) => (
                <tr key={item.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-2 pr-3">{item.renewal_year}</td>
                  <td className="py-2 pr-3">{item.renewal_date}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2 pr-3">{item.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
