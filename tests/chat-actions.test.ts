import { describe, expect, it } from "vitest";
import { getMainMenuOptions, resolveOptionAction } from "../lib/chat/actions";
import type { ChatSnapshot, ChatSnapshotMember } from "../lib/chat/types";

function member(overrides: Partial<ChatSnapshotMember>): ChatSnapshotMember {
  return {
    name: "Test Member",
    industry: "Finance",
    sponsor: null,
    memberSince: null,
    isCommittee: false,
    reportRole: null,
    latestScore: 6.5,
    latestColor: "green",
    latestReportMonth: "Apr",
    trafficHistory: [],
    monthlyReferrals: null,
    monthlyReferralsReceived: null,
    monthlyReportMonth: null,
    palmsReferrals: 12,
    palmsReferralsReceived: 6,
    palmsOneToOne: 8,
    palmsTyfcb: 5000,
    palmsCeu: 4,
    palmsVisitors: 2,
    renewalStatus: "active",
    renewalDate: "2026-07-01",
    renewalStage: "normal",
    isTwoYear: false,
    openTaskCount: 0,
    lifetimeSponsors: 1,
    pastYearSponsors: 0,
    lifetimeTrainings: 0,
    pastYearTrainings: 0,
    pastRoles: [],
    ...overrides,
  };
}

const snapshot: ChatSnapshot = {
  chapterName: "NOVA BNI",
  summary: {
    memberCount: 2,
    committeeCount: 1,
    activeCycles: 2,
    renewedCount: 1,
    droppedCount: 0,
    averageScore: 6.5,
    greenCount: 1,
    amberCount: 1,
    redCount: 0,
    greyCount: 0,
    totalTyfcb: 5000,
  },
  members: [
    member({
      name: "Alice Advisory",
      industry: "Finance",
      latestColor: "green",
      latestScore: 7.2,
      isCommittee: true,
      reportRole: "Secretary",
      palmsTyfcb: 5000,
      renewalStatus: "renewed",
      renewalStage: "Renewed",
      openTaskCount: 0,
      pastRoles: ["Secretary", "Treasurer"],
    }),
    member({
      name: "Bob Realty",
      industry: "Real Estate",
      latestColor: "amber",
      latestScore: 5.8,
      palmsTyfcb: 0,
      renewalStatus: "active",
      renewalStage: "Critical Deadline",
      openTaskCount: 2,
    }),
  ],
};

describe("chat quick-option actions", () => {
  it("returns a menu option for every main action", () => {
    const options = getMainMenuOptions();
    expect(options.length).toBe(5);
    expect(options.map((o) => o.action)).toEqual([
      "QUERY_PIPELINE",
      "ZONE_MENU",
      "QUERY_EXEC",
      "QUERY_TYFCB",
      "QUERY_COMMITTEE",
    ]);
  });

  it("lists members in the critical-deadline stage for QUERY_PIPELINE", () => {
    const reply = resolveOptionAction(
      { id: "opt_pipeline", label: "Pipeline", action: "QUERY_PIPELINE" },
      snapshot,
    );
    expect(reply.text).toContain("Bob Realty");
    expect(reply.text).toContain("Critical Deadline");
  });

  it("returns a zone submenu for ZONE_MENU", () => {
    const reply = resolveOptionAction(
      { id: "opt_zones", label: "Zones", action: "ZONE_MENU" },
      snapshot,
    );
    expect(reply.options.some((o) => o.action === "QUERY_ZONE")).toBe(true);
    expect(reply.options.some((o) => o.payload?.zone === "green")).toBe(true);
  });

  it("lists green members for QUERY_ZONE with green payload", () => {
    const reply = resolveOptionAction(
      { id: "opt_zone_green", label: "Green", action: "QUERY_ZONE", payload: { zone: "green" } },
      snapshot,
    );
    expect(reply.text).toContain("Alice Advisory");
    expect(reply.text).not.toContain("Bob Realty");
  });

  it("lists only the requested stage for QUERY_STAGE", () => {
    const reply = resolveOptionAction(
      {
        id: "opt_stage",
        label: "Critical Deadline",
        action: "QUERY_STAGE",
        payload: { stage: "Critical Deadline" },
      },
      snapshot,
    );
    expect(reply.text).toContain("Bob Realty");
    expect(reply.text).not.toContain("Alice Advisory");
  });

  it("reports an empty stage for QUERY_STAGE", () => {
    const reply = resolveOptionAction(
      {
        id: "opt_stage",
        label: "Payment Pending",
        action: "QUERY_STAGE",
        payload: { stage: "Payment Pending" },
      },
      snapshot,
    );
    expect(reply.text).toContain("No members are currently in the Payment Pending stage.");
  });
});