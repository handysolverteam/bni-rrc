"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import TrafficLightBadge from "@/components/TrafficLightBadge";
import { formatDisplayDate, formatTenure } from "@/lib/date-format";
import type { AchievementMemberListItem } from "@/lib/types";

type AchievementsDirectoryProps = {
  members: AchievementMemberListItem[];
};

export default function AchievementsDirectory({ members }: AchievementsDirectoryProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredMembers = members.filter(({ member, currentCycle }) => {
    if (!normalizedQuery) {
      return true;
    }

    const searchableText = [
      member.name,
      member.industry,
      member.report_role,
      currentCycle ? `renewing for ${currentCycle.renewal_year}` : null,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <label className="block" htmlFor="achievement-member-search">
          <p className="text-sm font-medium text-[var(--accent)]">Quick search</p>
          <input
            id="achievement-member-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by member name, industry, role, or renewal year"
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </label>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Showing {filteredMembers.length} of {members.length} members
        </p>
      </section>

      {filteredMembers.length === 0 ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)]">
          No members match that search yet.
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map(({ member, currentCycle, latestPalmsSnapshot }) => (
            <Link
              key={member.id}
              href={`/members/${member.id}/achievements`}
              className="focus-ring block rounded-md border border-[var(--line)] bg-white p-4 hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{member.name}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">{member.industry || "No industry"}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{member.report_role || "No role"}</p>
                </div>
                {currentCycle?.latest_traffic_light ? (
                  <TrafficLightBadge compact trafficLight={currentCycle.latest_traffic_light} />
                ) : (
                  <span className="text-sm text-[var(--muted)]">No score</span>
                )}
              </div>
              <div className="mt-4 space-y-1 text-sm text-[var(--muted)]">
                <p>{currentCycle ? `Renewing for ${currentCycle.renewal_year}` : "Renewal year unavailable"}</p>
                <p>{formatTenure(member.member_since)}</p>
                <p>
                  Joined on{" "}
                  {formatDisplayDate(member.member_since) === "-"
                    ? "not set"
                    : formatDisplayDate(member.member_since)}
                </p>
                <p>{latestPalmsSnapshot ? "PALMS achievements available" : "PALMS achievements not imported"}</p>
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--accent)]">View achievements</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
