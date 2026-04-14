"use client";

import { useMemo, useState } from "react";
import MemberCard from "@/components/MemberCard";
import { getDefaultMobileStage, groupCyclesByStage } from "@/lib/renewals/stage-groups";
import type { DashboardCycle } from "@/lib/types";

export default function DashboardKanban({ cycles }: { cycles: DashboardCycle[] }) {
  const groups = useMemo(() => groupCyclesByStage(cycles), [cycles]);
  const [activeStage, setActiveStage] = useState(() => getDefaultMobileStage(cycles));
  const activeGroup = groups.find((group) => group.stage === activeStage) ?? groups[0];

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-normal">Kanban</h2>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden">
        {groups.map((group) => (
          <button
            key={group.stage}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-3 py-2 text-sm ${
              group.stage === activeStage
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--line)] bg-white"
            }`}
            type="button"
            onClick={() => setActiveStage(group.stage)}
          >
            {group.stage} <span className="ml-1 opacity-80">{group.cycles.length}</span>
          </button>
        ))}
      </div>

      <div className="md:hidden">
        <div className="rounded-md border border-[var(--line)] bg-[#fbfbf8] p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{activeGroup.stage}</h3>
            <span className="rounded-md bg-white px-2 py-1 text-xs">{activeGroup.cycles.length}</span>
          </div>
          <div className="space-y-3">
            {activeGroup.cycles.map((cycle) => (
              <MemberCard key={cycle.id} cycle={cycle} />
            ))}
            {activeGroup.cycles.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
                No members here.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden gap-3 md:grid lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((group) => {
          return (
            <div key={group.stage} className="rounded-md border border-[var(--line)] bg-[#fbfbf8] p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{group.stage}</h3>
                <span className="rounded-md bg-white px-2 py-1 text-xs">{group.cycles.length}</span>
              </div>
              <div className="space-y-3">
                {group.cycles.map((cycle) => (
                  <MemberCard key={cycle.id} cycle={cycle} />
                ))}
                {group.cycles.length === 0 ? (
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
