import { describe, expect, it } from "vitest";
import { buildChecklistUpdates } from "../lib/renewals/checklist";
import { getDueTaskTriggers } from "../lib/renewals/tasks";
import type { RenewalCycle } from "../lib/types";

const cycle: RenewalCycle = {
  id: "cycle-1",
  member_id: "member-1",
  renewal_year: 2026,
  renewal_date: "2026-07-01",
  reported_due_date: null,
  status: "active",
  source_membership_status: "Active",
  auto_renewal_enabled: false,
  is_two_year_renewal: false,
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
};

describe("renewal tasks", () => {
  it("returns active trigger tasks due through the end of next week", () => {
    const triggers = getDueTaskTriggers(cycle, new Date("2026-03-03T00:00:00.000Z"));

    expect(triggers.map((trigger) => trigger.type)).toEqual([
      "mc_discussion",
    ]);
  });

  it("generates the four operational renewal tasks", () => {
    const triggers = getDueTaskTriggers(cycle, new Date("2026-06-09T00:00:00.000Z"));

    expect(triggers).toEqual([
      { type: "mc_discussion", dueDate: "2026-03-03" },
      { type: "member_discussion", dueDate: "2026-05-02" },
      { type: "docs_collection", dueDate: "2026-05-17" },
      { type: "payment_due", dueDate: "2026-06-01" },
    ]);
  });

  it("does not generate legacy or critical deadline tasks", () => {
    const triggers = getDueTaskTriggers(cycle, new Date("2026-06-09T00:00:00.000Z"));

    expect(triggers.map((trigger) => trigger.type)).not.toContain("monthly_review");
    expect(triggers.map((trigger) => trigger.type)).not.toContain("renewal_push");
    expect(triggers.map((trigger) => trigger.type)).not.toContain("critical_deadline");
  });

  it("does not generate triggers for completed renewal cycles", () => {
    expect(getDueTaskTriggers({ ...cycle, status: "renewed" })).toEqual([]);
  });

  it("does not generate triggers before the 120-day renewal work window", () => {
    expect(getDueTaskTriggers(cycle, new Date("2026-03-02T00:00:00.000Z"))).toEqual([]);
  });
});

describe("checklist updates", () => {
  it("sets completion dates when a checklist item is completed", () => {
    expect(
      buildChecklistUpdates(
        { payment_made: true },
        new Date("2026-04-14T00:00:00.000Z"),
      ),
    ).toEqual({
      payment_made: true,
      payment_made_date: "2026-04-14",
    });
  });

  it("clears completion dates when a checklist item is unchecked", () => {
    expect(buildChecklistUpdates({ checklist_filled: false })).toEqual({
      checklist_filled: false,
      checklist_filled_date: null,
    });
  });
});
