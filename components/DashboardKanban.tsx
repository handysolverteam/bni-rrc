import MemberCard from "@/components/MemberCard";
import { renewalStages } from "@/lib/renewals/stage";
import type { DashboardCycle } from "@/lib/types";

export default function DashboardKanban({ cycles }: { cycles: DashboardCycle[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-normal">Kanban</h2>
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {renewalStages.map((stage) => {
          const stageCycles = cycles.filter((cycle) => cycle.stage === stage);

          return (
            <div key={stage} className="rounded-md border border-[var(--line)] bg-[#fbfbf8] p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{stage}</h3>
                <span className="rounded-md bg-white px-2 py-1 text-xs">{stageCycles.length}</span>
              </div>
              <div className="space-y-3">
                {stageCycles.map((cycle) => (
                  <MemberCard key={cycle.id} cycle={cycle} />
                ))}
                {stageCycles.length === 0 ? (
                  <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                    No members here.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
