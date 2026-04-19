"use client";

import { useRouter } from "next/navigation";
import { isActiveRenewalTaskType, taskTypeLabels } from "@/lib/renewals/task-types";
import type { RenewalTask } from "@/lib/types";

export default function TaskList({ tasks }: { tasks: RenewalTask[] }) {
  const router = useRouter();
  const activeTasks = tasks.filter((task) => isActiveRenewalTaskType(task.task_type));

  async function updateTask(id: string, status: RenewalTask["status"]) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <h2 className="text-xl font-semibold tracking-normal">Tasks</h2>
      <div className="mt-4 space-y-3">
        {activeTasks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No follow-up tasks yet.</p>
        ) : (
          activeTasks.map((task) => (
            <div key={task.id} className="rounded-md border border-[var(--line)] p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{taskTypeLabels[task.task_type]}</p>
                  <p className="text-sm text-[var(--muted)]">Due {task.due_date}</p>
                </div>
                <select
                  className="focus-ring min-h-11 rounded-md border border-[var(--line)] p-2 text-sm"
                  defaultValue={task.status}
                  onChange={(event) => updateTask(task.id, event.target.value as RenewalTask["status"])}
                >
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
