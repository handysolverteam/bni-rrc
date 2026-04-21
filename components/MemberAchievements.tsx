"use client";

import Link from "next/link";
import { formatDisplayDate, formatTenure } from "@/lib/date-format";
import { buildMemberAchievements } from "@/lib/renewals/achievements";
import type { DashboardCycle, Member, MemberPalmsSnapshot } from "@/lib/types";
import TrafficLightBadge from "./TrafficLightBadge";

type MemberAchievementsPayload = {
  member: Member;
  currentCycle: DashboardCycle | null;
  latestPalmsSnapshot: MemberPalmsSnapshot | null;
};

function formatNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function formatCurrency(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MemberAchievements({ detail }: { detail: MemberAchievementsPayload }) {
  const trafficLightHistory = detail.currentCycle?.traffic_light_history ?? [];
  const achievements = buildMemberAchievements(detail.latestPalmsSnapshot, trafficLightHistory);
  const renewalLabel = detail.currentCycle
    ? `Renewing for ${detail.currentCycle.renewal_year}`
    : "Renewal year unavailable";
  const tenureLabel = formatTenure(detail.member.member_since);
  const joiningDateLabel =
    formatDisplayDate(detail.member.member_since) === "-"
      ? "Joining date not set"
      : formatDisplayDate(detail.member.member_since);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link className="text-[var(--accent)] hover:underline" href={`/members/${detail.member.id}`}>
          Back to member
        </Link>
        <Link className="text-[var(--accent)] hover:underline" href="/">
          Dashboard
        </Link>
      </div>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--accent)]">Lifetime achievements</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">{detail.member.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.industry || "No industry"}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.report_role || "No report role"}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <HeroHighlightCard label="Renewal" value={renewalLabel} />
              <HeroHighlightCard label="Tenure" value={tenureLabel} />
              <HeroHighlightCard label="Joined on" value={joiningDateLabel} />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {achievements.source === "palms"
                ? `PALMS totals for ${achievements.chapterName ?? "chapter"} from ${formatDisplayDate(
                    achievements.reportFrom,
                  )} to ${formatDisplayDate(achievements.reportTo)}`
                : achievements.source === "traffic_lights"
                  ? "No PALMS snapshot found. Showing totals rolled up from imported traffic-light history."
                  : "No PALMS or traffic-light data imported yet for this member."}
            </p>
          </div>
          <div className="min-w-52 rounded-md bg-[#eef1ea] px-4 py-3 lg:max-w-60">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Current standing</p>
            {detail.currentCycle?.latest_traffic_light ? (
              <div className="mt-2">
                <TrafficLightBadge trafficLight={detail.currentCycle.latest_traffic_light} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No current traffic-light score</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AchievementCard label="Attendance" value={formatNumber(achievements.attendance.presents)} />
        <AchievementCard label="No. absences" value={formatNumber(achievements.attendance.absences)} />
        <AchievementCard label="Visitors" value={formatNumber(achievements.visitors)} />
        <AchievementCard label="Total TYFCB" value={formatCurrency(achievements.tyfcb)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Attendance summary</h2>
          <MetricGrid
            items={[
              ["Present", formatNumber(achievements.attendance.presents)],
              ["Absent", formatNumber(achievements.attendance.absences)],
              ["Late", formatNumber(achievements.attendance.late)],
              ["Medical", formatNumber(achievements.attendance.medical)],
              ["Substitute", formatNumber(achievements.attendance.substitute)],
            ]}
          />
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Business and referrals</h2>
          <MetricGrid
            items={[
              ["Referrals given", formatNumber(achievements.referrals.givenTotal)],
              ["Referrals received", formatNumber(achievements.referrals.receivedTotal)],
              ["Given inside", formatNumber(achievements.referrals.givenInside)],
              ["Given outside", formatNumber(achievements.referrals.givenOutside)],
              ["Received inside", formatNumber(achievements.referrals.receivedInside)],
              ["Received outside", formatNumber(achievements.referrals.receivedOutside)],
              ["Visitors", formatNumber(achievements.visitors)],
              ["One-to-ones", formatNumber(achievements.oneToOnes)],
              ["TYFCB", formatCurrency(achievements.tyfcb)],
            ]}
          />
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Learning and growth</h2>
          <MetricGrid
            items={[
              ["Trainings", formatNumber(achievements.trainings)],
              ["CEU", formatNumber(achievements.ceu)],
              ["Testimonials", formatNumber(achievements.testimonials)],
            ]}
          />
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Data source</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">Source</dt>
              <dd>{achievements.source === "palms" ? "PALMS summary" : achievements.source === "traffic_lights" ? "Traffic-light fallback" : "No data"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">From</dt>
              <dd>{formatDisplayDate(achievements.reportFrom)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--muted)]">To</dt>
              <dd>{formatDisplayDate(achievements.reportTo)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function AchievementCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[var(--accent)]">{value}</p>
    </div>
  );
}

function HeroHighlightCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[var(--accent)]">{value}</p>
    </div>
  );
}

function MetricGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[var(--muted)]">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
