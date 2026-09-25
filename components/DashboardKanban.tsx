"use client";

import { useMemo, useState } from "react";
import MemberCard from "@/components/MemberCard";
import { getDefaultMobileStage, groupCyclesByStage, type StageGroup } from "@/lib/renewals/stage-groups";
import type { DashboardCycle } from "@/lib/types";

function StageColumn({
  group,
  collapsed,
  onToggle,
}: {
  group: StageGroup;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const collapsible = group.cycles.length > 1;
  const visibleCycles = collapsed ? group.cycles.slice(0, 1) : group.cycles;

  return (
    <div className="rounded-md border border-[var(--line)] bg-[#fbfbf8] p-3">
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${group.stage} column`}
          className="focus-ring mb-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="font-semibold">{group.stage}</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef1ea] text-xs font-semibold text-[var(--foreground)]">
              {group.cycles.length}
            </span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      ) : (
        <div className="mb-3 flex items-center justify-between px-1 py-1">
          <h3 className="flex items-center gap-2 font-semibold">
            {group.stage}
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef1ea] text-xs font-semibold text-[var(--foreground)]">
              {group.cycles.length}
            </span>
          </h3>
        </div>
      )}
      <div className="space-y-3">
        {visibleCycles.map((cycle) => (
          <MemberCard key={cycle.id} cycle={cycle} />
        ))}
        {group.cycles.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--line)] p-3 text-sm text-[var(--muted)]">
            No members here.
          </p>
        ) : null}
        {collapsed && group.cycles.length > 1 ? (
          <button
            type="button"
            onClick={onToggle}
            className="focus-ring min-h-11 w-full rounded-md border border-dashed border-[var(--line)] bg-white p-3 text-sm font-medium text-[var(--muted)] hover:bg-[#eef1ea]"
          >
            Show all {group.cycles.length} members
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardKanban({ cycles }: { cycles: DashboardCycle[] }) {
  const groups = useMemo(() => groupCyclesByStage(cycles), [cycles]);
  const [activeStage, setActiveStage] = useState(() => getDefaultMobileStage(cycles));
  const activeGroup = groups.find((group) => group.stage === activeStage) ?? groups[0];
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  const toggleStage = (stage: string) =>
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));

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
        <StageColumn
          group={activeGroup}
          collapsed={collapsedStages[activeGroup.stage] ?? false}
          onToggle={() => toggleStage(activeGroup.stage)}
        />
      </div>

      <div className="hidden gap-3 md:grid lg:grid-cols-3 xl:grid-cols-4">
        {groups.map((group) => (
          <StageColumn
            key={group.stage}
            group={group}
            collapsed={collapsedStages[group.stage] ?? false}
            onToggle={() => toggleStage(group.stage)}
          />
        ))}
      </div>
    </section>
  );
}
