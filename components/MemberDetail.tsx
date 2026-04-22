"use client";

import { useRouter } from "next/navigation";
import { formatDisplayDate, formatDisplayMonth } from "@/lib/date-format";
import { sortTrafficLightHistoryForDisplay } from "@/lib/renewals/traffic-light-history";
import type { DashboardCycle, Member } from "@/lib/types";
import TaskList from "./TaskList";
import TrafficLightBadge, { formatTrafficLightColor, TrafficLightTrend } from "./TrafficLightBadge";

type MemberDetailPayload = {
  member: Member;
  currentCycle: DashboardCycle | null;
  cycles: DashboardCycle[];
};

export default function MemberDetail({ detail }: { detail: MemberDetailPayload }) {
  const router = useRouter();
  const cycle = detail.currentCycle;
  const trafficLightHistory = cycle
    ? sortTrafficLightHistoryForDisplay(cycle.traffic_light_history)
    : [];

  async function updateCycle(payload: Record<string, unknown>) {
    if (!cycle) {
      return;
    }

    await fetch(`/api/renewal-cycles/${cycle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    router.refresh();
  }

  if (!cycle) {
    return (
      <div className="rounded-md border border-[var(--line)] bg-white p-4">
        <h1 className="text-2xl font-semibold">{detail.member.name}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">No renewal cycles have been imported yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--accent)]">
              {cycle.stage ?? "Not in active workflow"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">{detail.member.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.industry}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">{detail.member.report_role}</p>
            <a
              className="mt-3 inline-flex text-sm font-medium text-[var(--accent)] hover:underline"
              href={`/members/${detail.member.id}/achievements`}
            >
              View achievements
            </a>
            <a
              className="mt-2 inline-flex text-sm font-medium text-[var(--accent)] hover:underline"
              href={`/members/${detail.member.id}/performance`}
            >
              View past year performance
            </a>
            <div className="mt-4 rounded-md bg-[#eef1ea] px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Renewal date
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-normal text-[var(--accent)]">
                {formatDisplayDate(cycle.renewal_date)}
              </p>
              {cycle.is_two_year_renewal && cycle.reported_due_date ? (
                <div className="mt-3 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm">
                  <p className="font-medium text-[var(--accent)]">2-year renewal term</p>
                  <p className="mt-1 text-[var(--muted)]">
                    Reported due date {formatDisplayDate(cycle.reported_due_date)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <select
            className="focus-ring min-h-11 rounded-md border border-[var(--line)] p-2 text-sm"
            defaultValue={cycle.status}
            onChange={(event) => updateCycle({ status: event.target.value })}
          >
            <option value="active">Active</option>
            <option value="renewed">Renewed</option>
            <option value="dropped">Dropped</option>
          </select>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {cycle.latest_traffic_light ? (
          <div className="rounded-md border border-[var(--line)] bg-white p-4">
            <h2 className="text-xl font-semibold tracking-normal">Traffic light</h2>
            <div className="mt-3">
              <TrafficLightBadge trafficLight={cycle.latest_traffic_light} />
            </div>
            <TrafficLightTrend className="mt-3" history={cycle.traffic_light_history} />
            {trafficLightHistory.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                      <th className="py-2 pr-3 font-medium">Month</th>
                      <th className="py-2 pr-3 font-medium">Score</th>
                      <th className="py-2 pr-3 font-medium">Light</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficLightHistory.map((trafficLight) => (
                      <tr
                        key={`${trafficLight.member_id}-${trafficLight.report_month}`}
                        className="border-b border-[var(--line)] last:border-0"
                      >
                        <td className="py-2 pr-3">
                          {formatDisplayMonth(trafficLight.report_month)}
                        </td>
                        <td className="py-2 pr-3">{trafficLight.score}</td>
                        <td className="py-2 pr-3">{formatTrafficLightColor(trafficLight.color)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">P</dt>
                <dd>{cycle.latest_traffic_light.present_count}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">A</dt>
                <dd>{cycle.latest_traffic_light.absent_count}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">RGT</dt>
                <dd>{cycle.latest_traffic_light.referrals_given}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">RRT</dt>
                <dd>{cycle.latest_traffic_light.referrals_received}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Visitors</dt>
                <dd>{cycle.latest_traffic_light.visitors}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Trainings</dt>
                <dd>{cycle.latest_traffic_light.trainings}</dd>
              </div>
            </dl>
          </div>
        ) : null}
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="text-xl font-semibold tracking-normal">Renewal dates</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(cycle.derived_dates).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">{label.replaceAll("_", " ")}</dt>
                <dd>{formatDisplayDate(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <TaskList tasks={cycle.renewal_tasks ?? []} />
      </section>

      <section className="rounded-md border border-[var(--line)] bg-white p-4">
        <h2 className="text-xl font-semibold tracking-normal">Renewal history</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Reported due</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {detail.cycles.map((item) => (
                <tr key={item.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="py-2 pr-3">{item.renewal_year}</td>
                  <td className="py-2 pr-3">{formatDisplayDate(item.renewal_date)}</td>
                  <td className="py-2 pr-3">
                    {item.is_two_year_renewal ? formatDisplayDate(item.reported_due_date) : "-"}
                  </td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2 pr-3">{item.stage ?? "Not in active workflow"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
