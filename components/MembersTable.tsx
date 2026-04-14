import Link from "next/link";
import type { DashboardCycle } from "@/lib/types";

export default function MembersTable({ cycles }: { cycles: DashboardCycle[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-normal">Table view</h2>
      <div className="space-y-3 md:hidden">
        {cycles.map((cycle) => {
          const checklistDone = [
            cycle.online_form_filled,
            cycle.checklist_filled,
            cycle.payment_link_generated,
            cycle.payment_made,
          ].filter(Boolean).length;

          return (
            <Link
              key={cycle.id}
              className="block min-h-11 rounded-md border border-[var(--line)] bg-white p-3"
              href={`/members/${cycle.member.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--accent)]">{cycle.member.name}</p>
                  <p className="text-xs text-[var(--muted)]">{cycle.member.industry}</p>
                </div>
                <span className="rounded-md bg-[#eef1ea] px-2 py-1 text-xs">{cycle.stage}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
                <span>{cycle.renewal_date}</span>
                <span>{checklistDone}/4 checklist</span>
                <span>{cycle.open_task_count} tasks</span>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-md border border-[var(--line)] bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[#eef1ea]">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Renewal</th>
              <th className="px-3 py-2">Checklist</th>
              <th className="px-3 py-2">Open tasks</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => {
              const checklistDone = [
                cycle.online_form_filled,
                cycle.checklist_filled,
                cycle.payment_link_generated,
                cycle.payment_made,
              ].filter(Boolean).length;

              return (
                <tr key={cycle.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-[var(--accent)] hover:underline"
                      href={`/members/${cycle.member.id}`}
                    >
                      {cycle.member.name}
                    </Link>
                    <div className="text-xs text-[var(--muted)]">{cycle.member.industry}</div>
                  </td>
                  <td className="px-3 py-2">{cycle.stage}</td>
                  <td className="px-3 py-2">{cycle.renewal_date}</td>
                  <td className="px-3 py-2">{checklistDone}/4</td>
                  <td className="px-3 py-2">{cycle.open_task_count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
