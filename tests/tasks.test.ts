import { describe, expect, it } from "vitest";
import { buildChecklistUpdates } from "../lib/renewals/checklist";
import { getDueTaskTriggers } from "../lib/renewals/tasks";
import type { RenewalCycle } from "../lib/types";

const cycle: RenewalCycle = {
  id: "cycle-1",
  member_id: "member-1",
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
};

describe("renewal tasks", () => {
  it("returns trigger tasks due on or before today", () => {
    const triggers = getDueTaskTriggers(cycle, new Date("2026-05-17T00:00:00.000Z"));

    expect(triggers.map((trigger) => trigger.type)).toEqual([
      "mc_discussion",
      "member_discussion",
      "monthly_review",
      "renewal_push",
    ]);
  });

  it("does not generate triggers for completed renewal cycles", () => {
    expect(getDueTaskTriggers({ ...cycle, status: "renewed" })).toEqual([]);
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
