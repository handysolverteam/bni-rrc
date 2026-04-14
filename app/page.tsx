import DashboardKanban from "@/components/DashboardKanban";
import MembersTable from "@/components/MembersTable";
import { getDashboardCycles } from "@/lib/renewals/data";
import type { DashboardCycle } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let cycles: DashboardCycle[] = [];
  let error: string | null = null;

  try {
    cycles = await getDashboardCycles();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load dashboard";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--accent)]">Renewal pipeline</p>
        <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Track annual renewal cycles from MC discussion through payment and completion.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Connect Supabase to load data</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        </div>
      ) : (
        <>
          <DashboardKanban cycles={cycles} />
          <MembersTable cycles={cycles} />
        </>
      )}
    </div>
  );
}
