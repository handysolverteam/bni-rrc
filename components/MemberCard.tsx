import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-format";
import { getNextWorkflowTask } from "@/lib/renewals/task-inbox-model";
import { taskTypeLabels } from "@/lib/renewals/task-types";
import { getUrgency, type UrgencyLabel } from "@/lib/renewals/urgency";
import type { DashboardCycle } from "@/lib/types";
import TrafficLightBadge, { TrafficLightTrend } from "./TrafficLightBadge";

const cardAccentClasses = {
  red: "border-l-[#c73b2f]",
  yellow: "border-l-[#c49323]",
  green: "border-l-[#2f855a]",
  neutral: "border-l-[var(--line)]",
};

const dotClasses = {
  red: "bg-[#c73b2f]",
  yellow: "bg-[#c49323]",
  green: "bg-[#2f855a]",
};

function formatUrgencyLabel(label: UrgencyLabel): string {
  if (label === "overdue") {
    return "Overdue";
  }

  if (label === "due_soon") {
    return "Due soon";
  }

  return "Upcoming";
}

export default function MemberCard({ cycle }: { cycle: DashboardCycle }) {
  const nextTask = getNextWorkflowTask(cycle.renewal_tasks);
  const urgency = nextTask ? getUrgency(nextTask.due_date) : null;
  const accentClass = urgency ? cardAccentClasses[urgency.color] : cardAccentClasses.neutral;

  return (
    <Link
      href={`/members/${cycle.member.id}`}
      className={`focus-ring block min-h-11 rounded-md border border-l-4 border-[var(--line)] bg-white p-3 hover:border-[var(--accent)] ${accentClass}`}
    >
      <div>
        <h3 className="font-semibold">{cycle.member.name}</h3>
        <p className="text-sm text-[var(--muted)]">{cycle.member.industry || "No industry"}</p>
        {cycle.is_two_year_renewal ? (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            2-year renewal term
          </p>
        ) : null}
      </div>

      {cycle.latest_traffic_light ? (
        <div className="mt-3 space-y-2">
          <TrafficLightBadge trafficLight={cycle.latest_traffic_light} />
          <TrafficLightTrend history={cycle.traffic_light_history} />
        </div>
      ) : null}

      {nextTask && urgency ? (
        <div className="mt-4 space-y-1 text-sm">
          <p className="flex items-center gap-2 font-medium text-[var(--muted)]">
            <span className={`h-2.5 w-2.5 rounded-full ${dotClasses[urgency.color]}`} />
            {formatUrgencyLabel(urgency.urgency_label)}
          </p>
          <p className="font-medium text-[var(--accent)]">{taskTypeLabels[nextTask.task_type]}</p>
          <p className="text-[var(--muted)]">Due {formatDisplayDate(nextTask.due_date)}</p>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-[var(--muted)]">
        Renewal {formatDisplayDate(cycle.renewal_date)} - {cycle.open_task_count} open
      </p>
      {cycle.is_two_year_renewal && cycle.reported_due_date ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          Reported due {formatDisplayDate(cycle.reported_due_date)}
        </p>
      ) : null}
    </Link>
  );
}
