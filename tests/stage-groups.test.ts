import { describe, expect, it } from "vitest";
import { getDefaultMobileStage, groupCyclesByStage } from "../lib/renewals/stage-groups";
import type { DashboardCycle } from "../lib/types";

function cycle(stage: DashboardCycle["stage"]): DashboardCycle {
  return {
    id: `cycle-${stage}`,
    member_id: `member-${stage}`,
    renewal_year: 2026,
    renewal_date: "2026-07-01",
    status: "active",
    source_membership_status: "Active",
    auto_renewal_enabled: false,
    last_followup_date: null,
    next_followup_date: null,
    online_form_filled: false,
    online_form_filled_date: null,
    checklist_filled: false,
    checklist_filled_date: null,
    payment_link_generated: false,
    payment_link_generated_date: null,
    payment_made: false,
    payment_made_date: null,
    member: {
      id: `member-${stage}`,
      auth_user_id: null,
      name: "Member",
      industry: "Industry",
      sponsor: null,
      report_role: null,
      is_committee: false,
    },
    stage,
    derived_dates: {
      mc_discussion_date: "2026-03-03",
      member_discussion_date: "2026-04-02",
      monthly_review_date: "2026-05-02",
      renewal_push_date: "2026-05-17",
      docs_deadline: "2026-06-01",
      final_deadline: "2026-06-15",
    },
    assignments: [],
    renewal_tasks: [],
    open_task_count: 0,
  };
}

describe("stage groups", () => {
  it("selects the first stage with cycles as the default mobile stage", () => {
    expect(getDefaultMobileStage([cycle("Renewal Due"), cycle("Docs Pending")])).toBe(
      "Renewal Due",
    );
  });

  it("falls back to Upcoming when there are no cycles", () => {
    expect(getDefaultMobileStage([])).toBe("Upcoming");
  });

  it("groups cycles by every known stage", () => {
    const groups = groupCyclesByStage([cycle("Critical Deadline")]);

    expect(groups).toHaveLength(9);
    expect(groups.find((group) => group.stage === "Critical Deadline")?.cycles).toHaveLength(1);
  });
});
