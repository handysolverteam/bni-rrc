import { describe, expect, it } from "vitest";
import { sortInboxTasks, type TaskInboxItem } from "../lib/renewals/task-inbox-model";
import { getUrgency } from "../lib/renewals/urgency";
import type { Member } from "../lib/types";

const member: Member = {
  id: "member-1",
  auth_user_id: null,
  name: "Member One",
  industry: "Industry",
  sponsor: null,
  report_role: null,
  is_committee: false,
};

function inboxTask(id: string, dueDate: string, score: 100 | 70 | 30): TaskInboxItem {
  return {
    id,
    renewal_cycle_id: "cycle-1",
    task_type: "mc_discussion",
    due_date: dueDate,
    status: "open",
    notes: null,
    completed_at: null,
    member,
    renewal_date: "2026-07-01",
    urgency_score: score,
    urgency_label: score === 100 ? "overdue" : score === 70 ? "due_soon" : "upcoming",
    color: score === 100 ? "red" : score === 70 ? "yellow" : "green",
  };
}

describe("renewal task urgency", () => {
  const today = new Date("2026-04-19T00:00:00.000Z");

  it("marks dates before today as overdue", () => {
    expect(getUrgency("2026-04-18", today)).toEqual({
      urgency_score: 100,
      urgency_label: "overdue",
      color: "red",
    });
  });

  it("marks dates through the next three days as due soon", () => {
    expect(getUrgency("2026-04-22", today)).toEqual({
      urgency_score: 70,
      urgency_label: "due_soon",
      color: "yellow",
    });
  });

  it("marks dates more than three days away as upcoming", () => {
    expect(getUrgency("2026-04-23", today)).toEqual({
      urgency_score: 30,
      urgency_label: "upcoming",
      color: "green",
    });
  });

  it("sorts by highest urgency, then earliest due date", () => {
    const sorted = sortInboxTasks([
      inboxTask("upcoming", "2026-04-20", 30),
      inboxTask("overdue-later", "2026-04-18", 100),
      inboxTask("overdue-earlier", "2026-04-17", 100),
      inboxTask("due-soon", "2026-04-19", 70),
    ]);

    expect(sorted.map((task) => task.id)).toEqual([
      "overdue-earlier",
      "overdue-later",
      "due-soon",
      "upcoming",
    ]);
  });
});
