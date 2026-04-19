import type { Member, RenewalTask } from "../types";
import type { Urgency, UrgencyLabel } from "./urgency";

export type TaskInboxItem = RenewalTask &
  Urgency & {
    member: Member;
    renewal_date: string;
  };

export type TaskInboxGroups = Record<UrgencyLabel, TaskInboxItem[]>;

export function groupInboxTasks(tasks: TaskInboxItem[]): TaskInboxGroups {
  return {
    overdue: tasks.filter((task) => task.urgency_label === "overdue"),
    due_soon: tasks.filter((task) => task.urgency_label === "due_soon"),
    upcoming: tasks.filter((task) => task.urgency_label === "upcoming"),
  };
}

export function sortInboxTasks(tasks: TaskInboxItem[]): TaskInboxItem[] {
  return [...tasks].sort(
    (first, second) =>
      second.urgency_score - first.urgency_score ||
      first.due_date.localeCompare(second.due_date),
  );
}
