"use client";

import Link from "next/link";
import { formatDisplayMonth } from "@/lib/date-format";
import { buildPastYearPerformance } from "@/lib/renewals/past-year-performance";
import type { DashboardCycle, Member } from "@/lib/types";
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
  };
}) {
  const performance = buildPastYearPerformance(detail.currentCycle?.traffic_light_history ?? []);

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
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">Coverage</p>
              <p className="mt-1 text-2xl font-semibold tracking-normal text-[var(--accent)]">
                {performance.monthsCovered} month{performance.monthsCovered === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">Latest imported monthly traffic-light records</p>
            </div>
          </div>
          <MemberSectionNav active="performance" memberId={detail.member.id} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Referrals given" value={formatNumber(performance.totals.referralsGiven)} />
        <StatCard label="Referrals received" value={formatNumber(performance.totals.referralsReceived)} />
        <StatCard label="Visitors" value={formatNumber(performance.totals.visitors)} />
        <StatCard label="TYFCB" value={formatCurrency(performance.totals.tyfcb)} />
        <StatCard label="Presents" value={formatNumber(performance.totals.presents)} />
        <StatCard label="Absences" value={formatNumber(performance.totals.absences)} />
        <StatCard label="Testimonials" value={formatNumber(performance.totals.testimonials)} />
        <StatCard label="Trainings" value={formatNumber(performance.totals.trainings)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Score summary</h2>
          {performance.monthsCovered > 0 ? (
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <MetricItem label="Average" value={formatNumber(performance.scores.average)} />
              <MetricItem label="Best" value={formatNumber(performance.scores.best)} />
              <MetricItem label="Worst" value={formatNumber(performance.scores.worst)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No monthly history imported yet for yearly statistics.
            </p>
          )}
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Attendance details</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <MetricItem label="Late" value={formatNumber(performance.totals.late)} />
            <MetricItem label="Medical" value={formatNumber(performance.totals.medical)} />
            <MetricItem label="Substitute" value={formatNumber(performance.totals.substitute)} />
          </dl>
        </div>
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <h2 className="text-xl font-semibold tracking-normal">Month-wise trend</h2>
        {performance.history.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Light</th>
                  <th className="py-2 pr-3 font-medium">P</th>
                  <th className="py-2 pr-3 font-medium">A</th>
                  <th className="py-2 pr-3 font-medium">Referrals</th>
                  <th className="py-2 pr-3 font-medium">Visitors</th>
                  <th className="py-2 pr-3 font-medium">TYFCB</th>
                </tr>
              </thead>
              <tbody>
                {performance.history.map((trafficLight) => (
                  <tr
                    key={`${trafficLight.member_id}-${trafficLight.report_month}`}
                    className="border-b border-[var(--line)] last:border-0"
                  >
                    <td className="py-2 pr-3">{formatDisplayMonth(trafficLight.report_month)}</td>
                    <td className="py-2 pr-3">{trafficLight.score}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${trafficLightDotClasses[trafficLight.color]}`} />
                        {formatTrafficLightColor(trafficLight.color)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{trafficLight.present_count}</td>
                    <td className="py-2 pr-3">{trafficLight.absent_count}</td>
                    <td className="py-2 pr-3">{trafficLight.referrals_given}</td>
                    <td className="py-2 pr-3">{trafficLight.visitors}</td>
                    <td className="py-2 pr-3">{formatCurrency(trafficLight.tyfcb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No monthly history imported yet for yearly statistics.
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
