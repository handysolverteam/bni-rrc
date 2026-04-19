import TaskInbox from "@/components/TaskInbox";
import { getTaskInboxItems } from "@/lib/renewals/task-inbox";
import type { TaskInboxItem } from "@/lib/renewals/task-inbox-model";

export const dynamic = "force-dynamic";

export default async function TaskInboxPage() {
  let tasks: TaskInboxItem[] = [];
  let error: string | null = null;

  try {
    tasks = await getTaskInboxItems();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load task inbox";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--accent)]">Task Inbox</p>
        <h1 className="text-3xl font-semibold tracking-normal">Urgency Inbox</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Start with the most urgent open renewal task, then clear the queue.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Connect Supabase to load the inbox</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        </div>
      ) : (
        <TaskInbox tasks={tasks} />
      )}
    </div>
  );
}
