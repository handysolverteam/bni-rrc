import { formatDisplayMonth } from "@/lib/date-format";
import { sortTrafficLightHistoryForDisplay } from "@/lib/renewals/traffic-light-history";
import type { MemberTrafficLight, TrafficLightColor } from "@/lib/types";

export const trafficLightDotClasses: Record<TrafficLightColor, string> = {
  green: "bg-[#2f855a]",
  yellow: "bg-[#c49323]",
  red: "bg-[#c73b2f]",
  grey: "bg-[#8a8f85]",
};

export function formatTrafficLightColor(color: TrafficLightColor): string {
  return color === "grey" ? "Grey" : `${color[0].toUpperCase()}${color.slice(1)}`;
}

export default function TrafficLightBadge({
  trafficLight,
  compact = false,
}: {
  trafficLight: MemberTrafficLight;
  compact?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
      <span className={`h-2.5 w-2.5 rounded-full ${trafficLightDotClasses[trafficLight.color]}`} />
      <span className="font-medium text-[var(--ink)]">
        {formatTrafficLightColor(trafficLight.color)} {trafficLight.score}
      </span>
      {!compact ? <span>{formatDisplayMonth(trafficLight.report_month)}</span> : null}
    </p>
  );
}

export function TrafficLightTrend({
  history,
  className = "",
}: {
  history: MemberTrafficLight[];
  className?: string;
}) {
  const displayHistory = sortTrafficLightHistoryForDisplay(history);

  if (displayHistory.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-label="Traffic light trend">
      {displayHistory.map((trafficLight) => (
        <span
          key={`${trafficLight.member_id}-${trafficLight.report_month}`}
          className={`h-2.5 w-2.5 rounded-full ${trafficLightDotClasses[trafficLight.color]}`}
          title={`${formatDisplayMonth(trafficLight.report_month)}: ${formatTrafficLightColor(
            trafficLight.color,
          )} ${trafficLight.score}`}
        />
      ))}
    </div>
  );
}
