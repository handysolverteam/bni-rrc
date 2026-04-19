import { describe, expect, it } from "vitest";
import { calculateStage, getDerivedRenewalDates } from "../lib/renewals/stage";

const baseCycle = {
  renewal_date: "2026-07-01",
  status: "active" as const,
};

function utc(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

describe("calculateStage", () => {
  it("returns status stages first", () => {
    expect(calculateStage({ ...baseCycle, status: "renewed" }, utc("2025-01-01"))).toBe("Renewed");
    expect(calculateStage({ ...baseCycle, status: "dropped" }, utc("2025-01-01"))).toBe("Dropped");
  });

  it("covers every date-driven pipeline stage", () => {
    expect(calculateStage(baseCycle, utc("2026-03-31"))).toBeNull();
    expect(calculateStage(baseCycle, utc("2026-04-02"))).toBe("MC Discussion");
    expect(calculateStage(baseCycle, utc("2026-05-02"))).toBe("Member Discussion");
    expect(calculateStage(baseCycle, utc("2026-05-17"))).toBe("Documents Pending");
    expect(calculateStage(baseCycle, utc("2026-06-01"))).toBe("Payment Pending");
    expect(calculateStage(baseCycle, utc("2026-06-15"))).toBe("Critical Deadline");
  });

  it("calculates final deadline across year boundaries", () => {
    expect(getDerivedRenewalDates("2027-01-01").final_deadline).toBe("2026-12-15");
  });

  it("calculates active workflow dates", () => {
    expect(getDerivedRenewalDates("2026-06-01")).toMatchObject({
      mc_discussion_date: "2026-03-03",
      member_discussion_date: "2026-04-02",
      documents_sent_date: "2026-04-17",
      payment_due_date: "2026-05-02",
      final_deadline: "2026-05-15",
    });
  });
});
