import { describe, expect, it } from "vitest";
import { analyzeLocalChapterQuery } from "../lib/chat/localAiEngine";
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
      renewalStage: "normal",
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

describe("analyzeLocalChapterQuery", () => {
  it("answers a comparison request by name", () => {
    const reply = analyzeLocalChapterQuery("compare alice and bob", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).toContain("Bob Realty");
  });

  it("answers a member lookup by name", () => {
    const reply = analyzeLocalChapterQuery("tell me about alice", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).toContain("Secretary");
    expect(reply).toContain("Finance");
  });

  it("answers a specific stage with only that stage's members", () => {
    const reply = analyzeLocalChapterQuery("which members are in critical deadline", snapshot);
    expect(reply).toContain("Critical Deadline");
    expect(reply).toContain("Bob Realty");
    expect(reply).not.toContain("Alice Advisory");
  });

  it("reports an empty stage instead of dumping the pipeline", () => {
    const reply = analyzeLocalChapterQuery("show me everyone in payment pending", snapshot);
    expect(reply).toContain("No members are currently in the Payment Pending stage.");
    expect(reply).not.toContain("Bob Realty");
  });

  it("filters members by industry instead of dumping the directory", () => {
    const reply = analyzeLocalChapterQuery("list all members in finance", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).not.toContain("Bob Realty");
  });

  it("ranks members by open tasks", () => {
    const reply = analyzeLocalChapterQuery("who has the most open tasks", snapshot);
    expect(reply).toContain("Bob Realty");
    expect(reply).not.toContain("Alice Advisory");
  });

  it("lists overdue renewals, skipping renewed members", () => {
    const reply = analyzeLocalChapterQuery("list all overdue renewals", snapshot);
    expect(reply).toContain("Bob Realty");
    expect(reply).not.toContain("Alice Advisory");
  });

  it("lists renewals due in a time window", () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Soon Member", renewalDate: soon, renewalStatus: "active" })],
    };
    const reply = analyzeLocalChapterQuery("renewals due in the next 30 days", snap);
    expect(reply).toContain("Soon Member");
  });

  it("routes business leaders to TYFCB, not the Green zone", () => {
    const reply = analyzeLocalChapterQuery("show me business leaders", snapshot);
    expect(reply).toContain("TYFCB");
    expect(reply).not.toContain("Green Zone");
  });

  it("answers yellow-zone queries via the amber audit", () => {
    const reply = analyzeLocalChapterQuery("yellow zone members", snapshot);
    expect(reply).toContain("Bob Realty");
    expect(reply).not.toContain("Alice Advisory");
  });

  it("answers grey-zone queries including unscored members", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Uday Unscored", latestColor: null, latestScore: null })],
    };
    const reply = analyzeLocalChapterQuery("who is in the grey zone", snap);
    expect(reply).toContain("Uday Unscored");
  });

  it("lists referral leaders and zero-referral members", () => {
    const top = analyzeLocalChapterQuery("who passed the most referrals", snapshot);
    expect(top).toContain("Alice Advisory");
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Quiet Quinton", palmsReferrals: 0 })],
    };
    const zeros = analyzeLocalChapterQuery("who gave zero referrals", snap);
    expect(zeros).toContain("Quiet Quinton");
  });

  it("lists 1-to-1, ceu and visitor leaders", () => {
    expect(analyzeLocalChapterQuery("most 1-to-1s", snapshot)).toContain("Alice Advisory");
    expect(analyzeLocalChapterQuery("top ceu members", snapshot)).toContain("Alice Advisory");
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Guest Star", palmsVisitors: 3 })],
    };
    expect(analyzeLocalChapterQuery("who brought the most visitors", snap)).toContain(
      "Guest Star",
    );
  });

  it("finds past role holders by role name", () => {
    const reply = analyzeLocalChapterQuery("who held the secretary role", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).not.toContain("Bob Realty");
  });

  it("lists committee members", () => {
    const reply = analyzeLocalChapterQuery("who is on the committee", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).not.toContain("Bob Realty");
  });

  it("lists the newest members first", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Old Timer", memberSince: "2020-01-15" }),
        member({ name: "Fresh Face", memberSince: "2026-06-01" }),
      ],
    };
    const reply = analyzeLocalChapterQuery("who are the newest members", snap);
    expect(reply.indexOf("Fresh Face")).toBeLessThan(reply.indexOf("Old Timer"));
  });

  it("lists two-year renewal terms", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Decade Dan", isTwoYear: true })],
    };
    const reply = analyzeLocalChapterQuery("which members have a 2-year renewal term", snap);
    expect(reply).toContain("Decade Dan");
  });

  it("still answers greetings and routes help-with-topic to content", () => {
    expect(analyzeLocalChapterQuery("hello", snapshot)).toContain("What would you like");
    const redSnap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Rudhir Bhalla", latestColor: "red", latestScore: 40 })],
    };
    expect(analyzeLocalChapterQuery("help me find red members", redSnap)).toContain(
      "Rudhir Bhalla",
    );
  });

  it("detects members who slipped from green", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Slip Sam",
          latestColor: "amber",
          latestScore: 55,
          trafficHistory: [
            { month: "2026-06-01", score: 72, color: "green" },
            { month: "2026-07-01", score: 65, color: "amber" },
            { month: "2026-08-01", score: 55, color: "amber" },
          ],
        }),
        member({ name: "Steady Sue", latestColor: "green", latestScore: 80 }),
      ],
    };
    const reply = analyzeLocalChapterQuery("which members slipped from green to yellow", snap);
    expect(reply).toContain("Slip Sam");
    expect(reply).not.toContain("Steady Sue");
  });

  it("shows grey streaks for long-unscored members", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Ghost Member",
          latestColor: "grey",
          latestScore: 29,
          trafficHistory: [
            { month: "2026-06-01", score: 40, color: "red" },
            { month: "2026-07-01", score: 29, color: "grey" },
            { month: "2026-08-01", score: 29, color: "grey" },
          ],
        }),
      ],
    };
    const reply = analyzeLocalChapterQuery("who has been grey for months", snap);
    expect(reply).toContain("Ghost Member");
    expect(reply).toContain("2 consecutive");
  });

  it("includes the trendline in a member lookup", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Trend Tina",
          latestColor: "amber",
          latestScore: 55,
          trafficHistory: [
            { month: "2026-07-01", score: 70, color: "green" },
            { month: "2026-08-01", score: 55, color: "amber" },
          ],
        }),
      ],
    };
    const reply = analyzeLocalChapterQuery("what is trend tina's trend", snap);
    expect(reply).toContain("Trend Tina");
    expect(reply).toContain("Trend:");
  });

  it("answers last-month referrals from the monthly snapshot", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Monthly Max",
          monthlyReferrals: 5,
          monthlyReferralsReceived: 2,
          monthlyReportMonth: "2026-08-01",
        }),
      ],
    };
    const reply = analyzeLocalChapterQuery("referrals last month", snap);
    expect(reply).toContain("Monthly Max");
    expect(reply).toContain("Aug 2026");
  });

  it("says so when no monthly snapshot exists", () => {
    const reply = analyzeLocalChapterQuery("referrals last month", snapshot);
    expect(reply).toContain("No monthly PALMS snapshot");
  });

  it("falls back to a summary with a counter-question", () => {
    const reply = analyzeLocalChapterQuery("what's the weather?", snapshot);
    expect(reply).toContain("NOVA BNI");
    expect(reply).toContain("*Members:* 2");
  });
});