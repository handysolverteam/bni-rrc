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
    palmsReferrals: 12,
    palmsOneToOne: 8,
    palmsTyfcb: 5000,
    palmsCeu: 4,
    renewalStatus: "active",
    renewalDate: "2026-07-01",
    renewalStage: "normal",
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
      renewalStage: "expired_grace",
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

  it("falls back to a summary with a counter-question", () => {
    const reply = analyzeLocalChapterQuery("what's the weather?", snapshot);
    expect(reply).toContain("NOVA BNI");
    expect(reply).toContain("*Members:* 2");
  });
});