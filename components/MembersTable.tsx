import Link from "next/link";
import type { DashboardCycle } from "@/lib/types";

export default function MembersTable({ cycles }: { cycles: DashboardCycle[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-normal">Table view</h2>
      <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-white">
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
                    <Link className="font-medium text-[var(--accent)] hover:underline" href={`/members/${cycle.member.id}`}>
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
