"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDisplayDate, formatDisplayMonth } from "@/lib/date-format";
import { buildPastYearTrainingPerformance } from "@/lib/renewals/past-year-training-performance";
import { buildMonthlyPalmsPerformance } from "@/lib/renewals/palms-monthly-performance";
import { buildPastYearPerformance } from "@/lib/renewals/past-year-performance";
import { buildMemberPerformanceShareText } from "@/lib/renewals/performance-share";
import type {
  DashboardCycle,
  Member,
  MemberPalmsSnapshot,
  MemberTrainingAchievement,
} from "@/lib/types";
import MemberSectionNav from "./MemberSectionNav";
import { formatTrafficLightColor, trafficLightDotClasses } from "./TrafficLightBadge";

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

export default function MemberPerformance({
  detail,
}: {
  detail: {
    member: Member;
    currentCycle: DashboardCycle | null;
    palmsSnapshots: MemberPalmsSnapshot[];
    trainingAchievements: MemberTrainingAchievement[];
    performanceAnchorDate: string;
  };
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const trafficLightPerformance = buildPastYearPerformance(detail.currentCycle?.traffic_light_history ?? []);
  const palmsPerformance = buildMonthlyPalmsPerformance(detail.palmsSnapshots);
  const trainingPerformance = buildPastYearTrainingPerformance(
    detail.trainingAchievements,
    detail.performanceAnchorDate,
  );
  const palmsRange =
    palmsPerformance.monthlySnapshots.length > 0
      ? `${formatDisplayDate(palmsPerformance.monthlySnapshots[0].report_from)} to ${formatDisplayDate(
          palmsPerformance.monthlySnapshots[palmsPerformance.monthlySnapshots.length - 1].report_to,
        )}`
      : null;
  const trainingRange = `${formatDisplayDate(trainingPerformance.windowStart)} to ${formatDisplayDate(
    trainingPerformance.anchorDate,
  )}`;
  const trafficLightRange =
    trafficLightPerformance.history.length > 0
      ? `${formatDisplayMonth(
          trafficLightPerformance.history[0].report_window_start ??
            trafficLightPerformance.history[0].report_window_end ??
            trafficLightPerformance.history[0].report_month,
        )} to ${formatDisplayMonth(
          trafficLightPerformance.history[trafficLightPerformance.history.length - 1].report_window_end ??
            trafficLightPerformance.history[trafficLightPerformance.history.length - 1].report_month,
        )}`
      : null;
  const shareText = buildMemberPerformanceShareText({
    memberName: detail.member.name,
    palmsPerformance,
    palmsRange,
    trainingPerformance,
    trainingRange,
    trafficLightPerformance,
    trafficLightRange,
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--accent)]">Past year performance</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">{detail.member.name}</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.industry || "No industry"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.report_role || "No report role"}</p>
            </div>
            <div className="rounded-md bg-[#eef1ea] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Performance anchor
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-normal text-[var(--accent)]">
                {formatDisplayMonth(trainingPerformance.anchorDate)}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Past-year training window aligned to latest report date
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--accent)]">{trainingRange}</p>
            </div>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-[#f7f7f4] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Share On WhatsApp
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Ready-to-share past year performance summary with yearly totals and traffic-light trend.
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
          <MemberSectionNav active="performance" memberId={detail.member.id} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Referrals given" value={formatNumber(palmsPerformance.totals.referralsGiven)} />
        <StatCard label="Referrals received" value={formatNumber(palmsPerformance.totals.referralsReceived)} />
        <StatCard label="Visitors" value={formatNumber(palmsPerformance.totals.visitors)} />
        <StatCard label="TYFCB" value={formatCurrency(palmsPerformance.totals.tyfcb)} />
        <StatCard label="Presents" value={formatNumber(palmsPerformance.totals.presents)} />
        <StatCard label="Absences" value={formatNumber(palmsPerformance.totals.absences)} />
        <StatCard label="1-to-1s" value={formatNumber(palmsPerformance.totals.oneToOnes)} />
        <StatCard label="CEU" value={formatNumber(palmsPerformance.totals.ceu)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Traffic-light score trend</h2>
          {trafficLightRange ? (
            <p className="mt-1 text-sm text-[var(--muted)]">Date range: {trafficLightRange}</p>
          ) : null}
          {trafficLightPerformance.snapshotsCovered > 0 ? (
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <MetricItem label="Average" value={formatNumber(trafficLightPerformance.scores.average)} />
              <MetricItem label="Best" value={formatNumber(trafficLightPerformance.scores.best)} />
              <MetricItem label="Worst" value={formatNumber(trafficLightPerformance.scores.worst)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No traffic-light PDF snapshots imported yet.
            </p>
          )}
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Monthly PALMS totals</h2>
          {palmsRange ? (
            <p className="mt-1 text-sm text-[var(--muted)]">Date range: {palmsRange}</p>
          ) : null}
          {palmsPerformance.monthsCovered > 0 ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MetricItem label="Late" value={formatNumber(palmsPerformance.totals.late)} />
              <MetricItem label="Medical" value={formatNumber(palmsPerformance.totals.medical)} />
              <MetricItem label="Substitute" value={formatNumber(palmsPerformance.totals.substitute)} />
              <MetricItem label="Trainings" value={formatNumber(trainingPerformance.count)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No exact monthly PALMS files imported yet. Trainings still use imported BNI training rows.
            </p>
          )}
          <p className="mt-3 text-sm text-[var(--muted)]">
            Trainings count uses imported BNI training attendance from {trainingRange}.
          </p>
        </div>
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">Rolling traffic-light snapshots</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              These PDF rows are rolling report windows. Score and light are useful for trend, but counts are not treated as exact one-month values.
            </p>
            {trafficLightRange ? (
              <p className="mt-1 text-sm text-[var(--muted)]">Date range: {trafficLightRange}</p>
            ) : null}
          </div>
        </div>
        {trafficLightPerformance.history.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Window</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Light</th>
                </tr>
              </thead>
              <tbody>
                {trafficLightPerformance.history.map((trafficLight) => (
                  <tr
                    key={`${trafficLight.member_id}-${trafficLight.report_month}`}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-2 pr-3">
                      {trafficLight.report_window_start
                        ? `${formatDisplayMonth(trafficLight.report_window_start)} to ${formatDisplayMonth(
                            trafficLight.report_window_end ?? trafficLight.report_month,
                          )}`
                        : formatDisplayMonth(trafficLight.report_window_end ?? trafficLight.report_month)}
                    </td>
                    <td className="py-2 pr-3">{trafficLight.score}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${trafficLightDotClasses[trafficLight.color]}`} />
                        {formatTrafficLightColor(trafficLight.color)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No traffic-light PDF snapshots imported yet.
          </p>
        )}
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <h2 className="text-xl font-semibold tracking-normal">Exact monthly PALMS breakdown</h2>
        {palmsRange ? (
          <p className="mt-1 text-sm text-[var(--muted)]">Date range: {palmsRange}</p>
        ) : null}
        {palmsPerformance.monthlySnapshots.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">P</th>
                  <th className="py-2 pr-3 font-medium">A</th>
                  <th className="py-2 pr-3 font-medium">Medicals</th>
                  <th className="py-2 pr-3 font-medium">Substitutes</th>
                  <th className="py-2 pr-3 font-medium">Referrals</th>
                  <th className="py-2 pr-3 font-medium">Visitors</th>
                  <th className="py-2 pr-3 font-medium">1-to-1s</th>
                  <th className="py-2 pr-3 font-medium">TYFCB</th>
                </tr>
              </thead>
              <tbody>
                {palmsPerformance.monthlySnapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2 pr-3">{formatDisplayMonth(snapshot.report_to)}</td>
                    <td className="py-2 pr-3">{snapshot.present_count}</td>
                    <td className="py-2 pr-3">{snapshot.absent_count}</td>
                    <td className="py-2 pr-3">{snapshot.medical_count}</td>
                    <td className="py-2 pr-3">{snapshot.substitute_count}</td>
                    <td className="py-2 pr-3">
                      {snapshot.referrals_given_inside + snapshot.referrals_given_outside}
                    </td>
                    <td className="py-2 pr-3">{snapshot.visitors}</td>
                    <td className="py-2 pr-3">{formatNumber(snapshot.one_to_ones)}</td>
                    <td className="py-2 pr-3">{formatCurrency(snapshot.tyfcb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Upload exact monthly PALMS `.xls` files to see true month-by-month yearly totals here.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-[var(--accent)]">{value}</p>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
