"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDisplayDate, formatDisplayMonth, formatTenure } from "@/lib/date-format";
import { buildMemberAchievements } from "@/lib/renewals/achievements";
import { buildMemberAchievementShareText } from "@/lib/renewals/achievement-share";
import { sortTrafficLightHistoryForDisplay } from "@/lib/renewals/traffic-light-history";
import type {
  ChapterRole,
  DashboardCycle,
  Member,
  MemberPalmsSnapshot,
  MemberPastRoleEntry,
} from "@/lib/types";
import PastRolesSection from "./PastRolesSection";
import MemberSectionNav from "./MemberSectionNav";
import TrafficLightBadge, { trafficLightDotClasses } from "./TrafficLightBadge";

type MemberAchievementsPayload = {
  member: Member;
  currentCycle: DashboardCycle | null;
  latestPalmsSnapshot: MemberPalmsSnapshot | null;
  availableRoles: ChapterRole[];
  pastRoles: MemberPastRoleEntry[];
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const trafficLightHistory = detail.currentCycle?.traffic_light_history ?? [];
  const recentTrafficLights = sortTrafficLightHistoryForDisplay(trafficLightHistory).slice(-6);
  const achievements = buildMemberAchievements(detail.latestPalmsSnapshot, trafficLightHistory);
  const rolesHeld = detail.pastRoles.map((pastRole) => pastRole.role.name);
  const renewalLabel = detail.currentCycle
    ? `Renewing for ${detail.currentCycle.renewal_year}`
    : "Renewal year unavailable";
  const tenureLabel = formatTenure(detail.member.member_since);
  const joiningDateLabel =
    formatDisplayDate(detail.member.member_since) === "-"
      ? "Joining date not set"
      : formatDisplayDate(detail.member.member_since);
  const shareText = buildMemberAchievementShareText({
    memberName: detail.member.name,
    roles: detail.pastRoles,
    renewalLabel,
    tenureLabel,
    joiningDateLabel,
    achievements,
    trafficLightHistory,
  });

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

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
            <div className="mt-3 rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Roles held
              </p>
              {rolesHeld.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rolesHeld.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-white px-3 py-1 text-sm font-medium text-[var(--accent)] ring-1 ring-[var(--line)]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--muted)]">No past roles added yet</p>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <HeroHighlightCard label="Renewal" value={renewalLabel} />
              <HeroHighlightCard label="Tenure" value={tenureLabel} />
              <HeroHighlightCard label="Joined on" value={joiningDateLabel} />
            </div>
            <div className="mt-4 rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Share On WhatsApp
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    More lively recognition text with emojis, ready to preview and forward.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                    onClick={handleCopyMessage}
                    type="button"
                  >
                    {copyState === "copied"
                      ? "Copied"
                      : copyState === "error"
                        ? "Copy failed"
                        : "Copy message"}
                  </button>
                  <button
                    className="rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--accent)]"
                    onClick={() => setIsPreviewOpen((currentValue) => !currentValue)}
                    type="button"
                  >
                    {isPreviewOpen ? "Hide preview" : "Preview text"}
                  </button>
                </div>
              </div>
              {isPreviewOpen ? (
                <div className="mt-4 max-w-2xl rounded-[1.5rem] border border-[#d7e6d1] bg-[#eaf7dc] p-3">
                  <div className="rounded-[1.25rem] bg-white px-4 py-3 shadow-sm ring-1 ring-[#dfe7d8]">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                      WhatsApp preview
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
                      {shareText}
                    </pre>
                  </div>
                </div>
              ) : null}
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
        <div className="mt-4">
          <MemberSectionNav active="achievements" memberId={detail.member.id} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AchievementCard label="Attendance" value={formatNumber(achievements.attendance.presents)} />
        <AchievementCard label="No. absences" value={formatNumber(achievements.attendance.absences)} />
        <AchievementCard label="Visitors" value={formatNumber(achievements.visitors)} />
        <AchievementCard
          label="Total referrals given"
          value={formatNumber(achievements.referrals.givenTotal)}
          emphasize
        />
        <AchievementCard
          label="1-to-1s done"
          value={formatNumber(achievements.oneToOnes)}
          emphasize
        />
        <AchievementCard label="Total TYFCB" value={formatCurrency(achievements.tyfcb)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4 lg:col-span-2">
          <h2 className="text-xl font-semibold tracking-normal">Recent traffic lights</h2>
          {recentTrafficLights.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {recentTrafficLights.map((trafficLight) => (
                <div
                  key={`${trafficLight.member_id}-${trafficLight.report_month}`}
                  className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${trafficLightDotClasses[trafficLight.color]}`}
                    />
                    <p className="text-sm font-medium text-[var(--accent)]">
                      {formatDisplayMonth(trafficLight.report_month)}
                    </p>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-normal text-[var(--ink)]">
                    {trafficLight.score}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-[var(--muted)]">
                    {trafficLight.color}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No traffic-light history imported for the past six months yet.
            </p>
          )}
        </div>

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

      <PastRolesSection
        memberId={detail.member.id}
        availableRoles={detail.availableRoles}
        pastRoles={detail.pastRoles}
      />
    </div>
  );
}

function AchievementCard({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        emphasize
          ? "border-[var(--accent)] bg-[#eef1ea]"
          : "border-[var(--line)] bg-white"
      }`}
    >
      <p className={`text-sm ${emphasize ? "font-medium text-[var(--accent)]" : "text-[var(--muted)]"}`}>
        {label}
      </p>
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
