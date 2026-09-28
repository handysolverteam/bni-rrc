import { describe, expect, it } from "vitest";
import { resolveOptionAction } from "../lib/chat/actions";
import type { ChatOption } from "../lib/chat/types";
import type { ChatSnapshot, ChatSnapshotMember } from "../lib/chat/types";

function member(overrides: Partial<ChatSnapshotMember>): ChatSnapshotMember {
  return {
    name: "Test Member",
    industry: "Finance",
    sponsor: null,
    memberSince: null,
    isCommittee: false,
    reportRole: null,
    latestScore: 70,
    latestColor: "green",
    latestReportMonth: "Apr",
    trafficHistory: [],
    monthlyReferrals: null,
    monthlyReferralsReceived: null,
    monthlyReportMonth: null,
    palmsReferrals: 5,
    palmsReferralsReceived: 2,
    palmsOneToOne: 3,
    palmsTyfcb: 1000,
    palmsCeu: 1,
    palmsVisitors: 1,
    renewalStatus: "active",
    renewalDate: "2026-07-01",
    renewalStage: "Member Discussion",
    isTwoYear: false,
    openTaskCount: 0,
    lifetimeSponsors: 0,
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
    renewedCount: 0,
    droppedCount: 0,
    averageScore: 60,
    greenCount: 1,
    amberCount: 0,
    redCount: 1,
    greyCount: 0,
    totalTyfcb: 1000,
  },
  members: [
    member({ name: "Alice Advisory", isCommittee: true, reportRole: "Secretary" }),
    member({
      name: "Rohan Red",
      latestColor: "red",
      latestScore: 40,
      palmsTyfcb: 0,
      isCommittee: false,
      reportRole: null,
    }),
  ],
};

function opt(action: string, payload?: Record<string, unknown>): ChatOption {
  return { id: `opt_${action}`, label: action, action, payload };
}

describe("resolveOptionAction", () => {
  it("opens the main menu with options", () => {
    const reply = resolveOptionAction(opt("MAIN_MENU"), snapshot);
    expect(reply.text).toContain("Main Menu");
    expect(reply.options.length).toBeGreaterThan(0);
  });

  it("opens the zone menu with one option per zone", () => {
    const reply = resolveOptionAction(opt("ZONE_MENU"), snapshot);
    const actions = reply.options.map((o) => o.action);
    expect(actions).toContain("QUERY_ZONE");
    expect(reply.options.length).toBeGreaterThanOrEqual(4);
  });

  it("summarizes the renewal pipeline by stage", () => {
    const reply = resolveOptionAction(opt("QUERY_PIPELINE"), snapshot);
    expect(reply.text).toContain("Renewal Pipeline Overview");
    expect(reply.text).toContain("Member Discussion");
  });

  it("lists stage members and handles unknown stages", () => {
    const known = resolveOptionAction(
      opt("QUERY_STAGE", { stage: "Member Discussion" }),
      snapshot,
    );
    expect(known.text).toContain("Alice Advisory");
    const unknown = resolveOptionAction(opt("QUERY_STAGE", { stage: "Bananas" }), snapshot);
    expect(unknown.text).toContain("No members");
  });

  it("audits a zone and falls back to the zone menu for unknown zones", () => {
    const red = resolveOptionAction(opt("QUERY_ZONE", { zone: "red" }), snapshot);
    expect(red.text).toContain("Rohan Red");
    const bogus = resolveOptionAction(opt("QUERY_ZONE", { zone: "purple" }), snapshot);
    expect(bogus.text).not.toContain("Grey Zone");
    expect(bogus.text).toContain("Zone Breakdown");
  });

  it("shows the executive overview with chapter totals", () => {
    const reply = resolveOptionAction(opt("QUERY_EXEC"), snapshot);
    expect(reply.text).toContain("NOVA BNI");
    expect(reply.text).toContain("Total Members");
  });

  it("lists TYFCB leaders and handles missing data", () => {
    const leaders = resolveOptionAction(opt("QUERY_TYFCB"), snapshot);
    expect(leaders.text).toContain("Alice Advisory");
    const empty: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Broke Bob", palmsTyfcb: 0 })],
    };
    expect(resolveOptionAction(opt("QUERY_TYFCB"), empty).text).toContain("No TYFCB");
  });

  it("lists committee members and handles an empty committee", () => {
    const full = resolveOptionAction(opt("QUERY_COMMITTEE"), snapshot);
    expect(full.text).toContain("Alice Advisory");
    expect(full.text).not.toContain("Rohan Red");
    const empty: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Solo Sam", isCommittee: false })],
    };
    expect(resolveOptionAction(opt("QUERY_COMMITTEE"), empty).text).toContain(
      "No committee members",
    );
  });

  it("compares two members side by side and handles bad payloads", () => {
    const good = resolveOptionAction(
      opt("COMPARE_MEMBERS", { left: "Alice Advisory", right: "Rohan Red" }),
      snapshot,
    );
    expect(good.text).toContain("Side-by-Side Comparison");
    expect(good.text).toContain("Alice Advisory");
    expect(good.text).toContain("Rohan Red");
    const bad = resolveOptionAction(
      opt("COMPARE_MEMBERS", { left: "Alice Advisory", right: "Nobody" }),
      snapshot,
    );
    expect(bad.text).toContain("Could not match");
  });

  it("falls back to the menu for unknown actions", () => {
    expect(resolveOptionAction(opt("NOPE"), snapshot).text).toContain("Select an option");
  });
});
