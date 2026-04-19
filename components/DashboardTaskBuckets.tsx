import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-format";
import { getDashboardTaskBuckets, type DashboardTaskBucketKey } from "@/lib/renewals/task-buckets";
import { taskTypeLabels } from "@/lib/renewals/task-types";
import type { DashboardCycle } from "@/lib/types";

const bucketLabels: Record<DashboardTaskBucketKey, string> = {
  pastDue: "Past Due",
  thisWeek: "This Week",
  nextWeek: "Next Week",
};

const emptyMessages: Record<DashboardTaskBucketKey, string> = {
  pastDue: "No overdue open tasks.",
  thisWeek: "No open tasks due this week.",
  nextWeek: "No open tasks due next week.",
};

export default function DashboardTaskBuckets({ cycles }: { cycles: DashboardCycle[] }) {
  const buckets = getDashboardTaskBuckets(cycles);
  const bucketKeys: DashboardTaskBucketKey[] = ["pastDue", "thisWeek", "nextWeek"];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-normal">Upcoming tasks</h2>
        <p className="text-sm text-[var(--muted)]">Open renewal work grouped by due date.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {bucketKeys.map((key) => (
          <div key={key} className="rounded-md border border-[var(--line)] bg-[#fbfbf8] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{bucketLabels[key]}</h3>
              <span className="rounded-md bg-white px-2 py-1 text-xs">{buckets[key].length}</span>
            </div>

            <div className="space-y-3">
              {buckets[key].length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                  {emptyMessages[key]}
                </p>
              ) : (
                buckets[key].map((task) => (
                  <Link
                    key={task.id}
                    className="focus-ring block rounded-md border border-[var(--line)] bg-white p-3 hover:border-[var(--accent)]"
                    href={`/members/${task.member.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--accent)]">{taskTypeLabels[task.task_type]}</p>
                        <p className="text-sm text-[var(--muted)]">{task.member.name}</p>
                      </div>
                      <span className="rounded-md bg-[#eef1ea] px-2 py-1 text-xs">
                        {task.stage ?? "Not started"}
                      </span>
                    </div>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--muted)]">Due</dt>
                        <dd>{formatDisplayDate(task.due_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--muted)]">Renewal</dt>
                        <dd>{formatDisplayDate(task.renewal_date)}</dd>
                      </div>
                    </dl>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
