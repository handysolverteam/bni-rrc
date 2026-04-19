"use client";

import { useRouter } from "next/navigation";
import { formatDisplayDate } from "@/lib/date-format";
import { taskTypeLabels } from "@/lib/renewals/task-types";
import { groupInboxTasks, type TaskInboxItem } from "@/lib/renewals/task-inbox-model";
import type { RenewalTask } from "@/lib/types";

const sectionLabels = {
  overdue: "🔴 Overdue",
  due_soon: "🟡 Due Soon (Next 5 Days)",
  upcoming: "🟢 Upcoming",
};

const sectionOrder = ["overdue", "due_soon", "upcoming"] as const;

const indicatorClasses: Record<TaskInboxItem["color"], string> = {
  red: "border-l-[#c73b2f] bg-[#fff1ef]",
  yellow: "border-l-[#c49323] bg-[#fff9e8]",
  green: "border-l-[#2f855a] bg-white",
};

const dotClasses: Record<TaskInboxItem["color"], string> = {
  red: "bg-[#c73b2f]",
  yellow: "bg-[#c49323]",
  green: "bg-[#2f855a]",
};

function formatUrgency(label: TaskInboxItem["urgency_label"]): string {
  if (label === "overdue") {
    return "Overdue";
  }

  if (label === "due_soon") {
    return "Due soon";
  }

  return "Upcoming";
}

export default function TaskInbox({ tasks }: { tasks: TaskInboxItem[] }) {
  const router = useRouter();
  const groups = groupInboxTasks(tasks);
  const nextAction = tasks[0] ?? null;

  async function updateTask(id: string, status: RenewalTask["status"]) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="sticky top-0 z-10 -mx-4 border-b border-[var(--line)] bg-[var(--background)] px-4 py-3 md:static md:mx-0 md:rounded-md md:border md:bg-white">
        <p className="text-sm font-medium text-[var(--accent)]">Next Action:</p>
        {nextAction ? (
          <button
            className="focus-ring mt-1 block w-full rounded-md text-left"
            type="button"
            onClick={() => router.push(`/members/${nextAction.member.id}`)}
          >
            <span className="block text-xl font-semibold tracking-normal">
              {nextAction.member.name} - {taskTypeLabels[nextAction.task_type]}
            </span>
            <span className="mt-1 block text-sm text-[var(--muted)]">
              Due {formatDisplayDate(nextAction.due_date)}
            </span>
          </button>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">No open tasks.</p>
        )}
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <p className="font-semibold">
          You have: <span className="text-[#c73b2f]">🔴 {groups.overdue.length} overdue</span>{" "}
          <span className="text-[#c49323]">🟡 {groups.due_soon.length} due soon</span>
        </p>
      </section>

      <div className="space-y-5">
        {sectionOrder.map((key) => (
          <section key={key} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-normal">{sectionLabels[key]}</h2>
              <span className="rounded-md bg-white px-2 py-1 text-sm">{groups[key].length}</span>
            </div>

            {groups[key].length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
                No open tasks here.
              </p>
            ) : (
              <div className="space-y-3">
                {groups[key].map((task) => (
                  <article
                    key={task.id}
                    className={`focus-within:border-[var(--accent)] rounded-md border border-l-4 border-[var(--line)] p-4 ${indicatorClasses[task.color]}`}
                    onClick={() => router.push(`/members/${task.member.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/members/${task.member.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          aria-label={formatUrgency(task.urgency_label)}
                          className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClasses[task.color]}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{task.member.name}</p>
                          <p className="text-sm font-medium text-[var(--accent)]">
                            {taskTypeLabels[task.task_type]}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            Due {formatDisplayDate(task.due_date)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                        <button
                          className="focus-ring rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateTask(task.id, "completed");
                          }}
                        >
                          Complete
                        </button>
                        <button
                          className="focus-ring rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--danger)]"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            updateTask(task.id, "cancelled");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
