import Link from "next/link";
import type { DashboardCycle } from "@/lib/types";

export default function MemberCard({ cycle }: { cycle: DashboardCycle }) {
  const checklistDone = [
    cycle.online_form_filled,
    cycle.checklist_filled,
    cycle.payment_link_generated,
    cycle.payment_made,
  ].filter(Boolean).length;

  return (
    <Link
      href={`/members/${cycle.member.id}`}
      className="focus-ring block min-h-11 rounded-md border border-[var(--line)] bg-white p-3 hover:border-[var(--accent)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{cycle.member.name}</h3>
          <p className="text-sm text-[var(--muted)]">{cycle.member.industry || "No industry"}</p>
        </div>
        <span className="rounded-md bg-[#eef1ea] px-2 py-1 text-xs">{checklistDone}/4</span>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Renewal</dt>
          <dd>{cycle.renewal_date}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Tasks</dt>
          <dd>{cycle.open_task_count} open</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--muted)]">Next</dt>
          <dd>{cycle.next_followup_date || "Not set"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {cycle.assignments.length > 0
          ? cycle.assignments.map((assignment) => assignment.assignee?.name).filter(Boolean).join(", ")
          : "No assignees"}
      </p>
    </Link>
  );
}
