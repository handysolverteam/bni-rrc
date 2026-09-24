import DashboardTaskBuckets from "@/components/DashboardTaskBuckets";
import { getDashboardCycles } from "@/lib/cache";
import type { DashboardCycle } from "@/lib/types";

export const revalidate = 60;

export default async function TasksPage() {
  let cycles: DashboardCycle[] = [];
  let error: string | null = null;

  try {
    cycles = await getDashboardCycles();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load tasks";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--accent)]">Renewal follow-ups</p>
        <h1 className="text-3xl font-semibold tracking-normal">Tasks</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Review open renewal work that is past due, required this week, or coming next week.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Connect Supabase to load tasks</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        </div>
      ) : (
        <DashboardTaskBuckets cycles={cycles} />
      )}
    </div>
  );
}
