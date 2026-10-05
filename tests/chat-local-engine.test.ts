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
      members: [member({ name: "Rohan Bhandari", latestColor: "red", latestScore: 40 })],
    };
    expect(analyzeLocalChapterQuery("help me find red members", redSnap)).toContain(
      "Rohan Bhandari",
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

  it("prefers the exact full-name hit when another member shares a name part", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Amit Sharma" })],
    };
    const reply = analyzeLocalChapterQuery("Amit gupta details", snap);
    expect(reply).toContain("Member Record: Amit Gupta");
    expect(reply).not.toContain("Multiple members match");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("disambiguates instead of dumping the overview when several members match", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Amit Sharma" })],
    };
    const reply = analyzeLocalChapterQuery("how is amit doing", snap);
    expect(reply).toContain("Multiple members match");
    expect(reply).toContain("Amit Gupta");
    expect(reply).toContain("Amit Sharma");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("compares with 'vs.' punctuation, not just 'vs'", () => {
    const reply = analyzeLocalChapterQuery("alice vs. bob", snapshot);
    expect(reply).toContain("Alice Advisory");
    expect(reply).toContain("Bob Realty");
    expect(reply).toContain("Member Comparison");
  });

  it("handles trailing punctuation on menu-style queries", () => {
    expect(analyzeLocalChapterQuery("members?", snapshot)).toContain("Full Member Directory");
    expect(analyzeLocalChapterQuery("hi?", snapshot)).toContain("What would you like");
    expect(analyzeLocalChapterQuery("yellow zone members?", snapshot)).toContain("Bob Realty");
  });

  it("answers task-directory phrasings with the open-tasks leaderboard", () => {
    expect(analyzeLocalChapterQuery("show all tasks", snapshot)).toContain("Most Open Tasks");
    expect(analyzeLocalChapterQuery("tasks", snapshot)).toContain("Bob Realty");
  });

  it("summarizes all zones for a bare zones query", () => {
    const reply = analyzeLocalChapterQuery("zones", snapshot);
    expect(reply).toContain("Zone Breakdown");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("catches renewals due tomorrow without needing a day count", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Nina Near",
          renewalDate: tomorrow,
          renewalStatus: "active",
          renewalStage: "normal",
        }),
      ],
    };
    const reply = analyzeLocalChapterQuery("renewals due tomorrow", snap);
    expect(reply).toContain("Nina Near");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("ranks received referrals separately from given ones", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Giver Gina", palmsReferrals: 12, palmsReferralsReceived: 2 }),
        member({ name: "Receiver Ron", palmsReferrals: 3, palmsReferralsReceived: 9 }),
      ],
    };
    const received = analyzeLocalChapterQuery("who received the most referrals", snap);
    expect(received.indexOf("Receiver Ron")).toBeLessThan(received.indexOf("Giver Gina"));
    const given = analyzeLocalChapterQuery("who gave the most referrals", snap);
    expect(given.indexOf("Giver Gina")).toBeLessThan(given.indexOf("Receiver Ron"));
  });

  it("lists zero 1-to-1, CEU and visitor members on request", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Social Sue", palmsOneToOne: 8, palmsCeu: 4, palmsVisitors: 2 }),
        member({ name: "Quiet Quinton", palmsOneToOne: 0, palmsCeu: 0, palmsVisitors: 0 }),
      ],
    };
    const ones = analyzeLocalChapterQuery("who has zero 1-to-1s", snap);
    expect(ones).toContain("Quiet Quinton");
    expect(ones).not.toContain("Social Sue");
    const ceu = analyzeLocalChapterQuery("members with zero ceu", snap);
    expect(ceu).toContain("Quiet Quinton");
    expect(ceu).not.toContain("Social Sue");
    const visitors = analyzeLocalChapterQuery("who brought no visitors", snap);
    expect(visitors).toContain("Quiet Quinton");
    expect(visitors).not.toContain("Social Sue");
  });

  it("handles joiner, tenure and oldest phrasings for newest members", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Veteran Vera", memberSince: "2020-01-15" }),
        member({ name: "Fresh Face", memberSince: "2026-06-01" }),
      ],
    };
    const joiners = analyzeLocalChapterQuery("recent joiners", snap);
    expect(joiners.indexOf("Fresh Face")).toBeLessThan(joiners.indexOf("Veteran Vera"));
    const oldest = analyzeLocalChapterQuery("oldest members", snap);
    expect(oldest.indexOf("Veteran Vera")).toBeLessThan(oldest.indexOf("Fresh Face"));
    expect(analyzeLocalChapterQuery("longest tenure", snap)).toContain("Veteran Vera");
    const asc = analyzeLocalChapterQuery(
      "List all the members as per joining date in ascending order",
      snap,
    );
    expect(asc.indexOf("Veteran Vera")).toBeLessThan(asc.indexOf("Fresh Face"));
    expect(asc).not.toContain("Chapter AI Overview");
    const desc = analyzeLocalChapterQuery("members by joining date, newest first", snap);
    expect(desc.indexOf("Fresh Face")).toBeLessThan(desc.indexOf("Veteran Vera"));
  });

  it("labels vice-president queries correctly", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Deputy Dan", pastRoles: ["Vice President"] })],
    };
    expect(analyzeLocalChapterQuery("who was the vice president", snap)).toContain(
      "Vice President experience",
    );
  });

  it("answers current-role queries with the current holder", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Ex Ed", pastRoles: ["President"] }),
        member({ name: "Prez Pam", reportRole: "President", pastRoles: [] }),
      ],
    };
    const reply = analyzeLocalChapterQuery("who is the current president", snap);
    expect(reply).toContain("Prez Pam");
    expect(reply).not.toContain("Ex Ed");
  });

  it("lists renewed and dropped members even outside the work window", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Rita Ray", renewalStatus: "renewed", renewalStage: null }),
        member({ name: "Doug Doyle", renewalStatus: "dropped", renewalStage: null }),
      ],
    };
    const renewed = analyzeLocalChapterQuery("renewed members", snap);
    expect(renewed).toContain("Rita Ray");
    expect(renewed).not.toContain("Chapter AI Overview");
    const dropped = analyzeLocalChapterQuery("dropped members", snap);
    expect(dropped).toContain("Doug Doyle");
    expect(dropped).not.toContain("Chapter AI Overview");
  });

  it("maps reversed document phrasings to the Documents Pending stage", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Don Dover", renewalStage: "Documents Pending" })],
    };
    const reply = analyzeLocalChapterQuery("pending documents", snap);
    expect(reply).toContain("Don Dover");
    expect(reply).toContain("Documents Pending");
  });

  it("routes lowest and highest score queries to the right zone", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Ruby Red", latestColor: "red", latestScore: 30 }),
        member({ name: "Greta Green", latestColor: "green", latestScore: 95 }),
      ],
    };
    const low = analyzeLocalChapterQuery("lowest score", snap);
    expect(low).toContain("Ruby Red");
    expect(low).not.toContain("Chapter AI Overview");
    const high = analyzeLocalChapterQuery("highest score", snap);
    expect(high).toContain("Greta Green");
    expect(high).not.toContain("Chapter AI Overview");
  });

  it("acknowledges thanks and goodbye instead of dumping the overview", () => {
    expect(analyzeLocalChapterQuery("thanks", snapshot).toLowerCase()).toContain("welcome");
    expect(analyzeLocalChapterQuery("bye", snapshot)).toContain("Goodbye");
  });

  it("compares two names joined by 'and' without the word compare", () => {
    const reply = analyzeLocalChapterQuery("alice and bob", snapshot);
    expect(reply).toContain("Member Comparison");
    expect(reply).toContain("Alice Advisory");
    expect(reply).toContain("Bob Realty");
  });

  it("compares two full names joined by 'and'", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Rohit Sharma" })],
    };
    const reply = analyzeLocalChapterQuery("Amit Gupta and Rohit Sharma", snap);
    expect(reply).toContain("Member Comparison");
    expect(reply).toContain("Amit Gupta");
    expect(reply).toContain("Rohit Sharma");
  });

  it("still disambiguates a greeting with a comma and a shared name", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Amit Sharma" })],
    };
    const reply = analyzeLocalChapterQuery("hi, how is amit doing", snap);
    expect(reply).toContain("Multiple members match");
    expect(reply).not.toContain("Member Comparison");
  });

  it("survives an empty member directory without crashing", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [],
      summary: { ...snapshot.summary, memberCount: 0 },
    };
    const overview = analyzeLocalChapterQuery("what's the weather?", snap);
    expect(overview).toContain("*Members:* 0");
    expect(analyzeLocalChapterQuery("members?", snap)).toContain(
      "Full Member Directory (0 Members)",
    );
  });

  it("answers self-queries from the signed-in display name", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Alice A" })],
    };
    expect(analyzeLocalChapterQuery("how am i doing", snap, "Amit Gupta")).toContain(
      "Member Record: Amit Gupta",
    );
    expect(analyzeLocalChapterQuery("my renewal status", snap, "amit")).toContain(
      "Member Record: Amit Gupta",
    );
  });

  it("says so when the signed-in user matches no member", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" })],
    };
    const reply = analyzeLocalChapterQuery("my renewal status", snap, "Stranger X");
    expect(reply).toContain("couldn't tell which member you are");
    expect(reply).not.toContain("Member Record");
  });

  it("compares me against a named member", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Alice A" })],
    };
    const reply = analyzeLocalChapterQuery("compare me and alice", snap, "Amit Gupta");
    expect(reply).toContain("Member Comparison");
    expect(reply).toContain("Amit Gupta");
    expect(reply).toContain("Alice A");
  });

  it("prefers the named member over self on mixed queries", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Alice A" })],
    };
    const reply = analyzeLocalChapterQuery("my friend alice details", snap, "Amit Gupta");
    expect(reply).toContain("Member Record: Alice A");
  });

  it("routes worst and bare best queries to the right zone", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Ruby Red", latestColor: "red", latestScore: 30 }),
        member({ name: "Greta Green", latestColor: "green", latestScore: 95 }),
      ],
    };
    const worst = analyzeLocalChapterQuery("worst member", snap);
    expect(worst).toContain("Ruby Red");
    expect(worst).not.toContain("Chapter AI Overview");
    const best = analyzeLocalChapterQuery("best", snap);
    expect(best).toContain("Greta Green");
    expect(best).not.toContain("Chapter AI Overview");
  });

  it("routes traffic phrasings to the zone breakdown", () => {
    const reply = analyzeLocalChapterQuery("show traffic lights", snapshot);
    expect(reply).toContain("Zone Breakdown");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("opens the capabilities menu for menu and assist phrasings", () => {
    expect(analyzeLocalChapterQuery("main menu", snapshot)).toContain(
      "What would you like me to look up",
    );
    expect(analyzeLocalChapterQuery("assist me", snapshot)).toContain(
      "What would you like me to look up",
    );
  });

  it("filters newest members by a join year", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Veteran Vera", memberSince: "2020-01-15" }),
        member({ name: "Fresh Face", memberSince: "2026-06-01" }),
      ],
    };
    const reply = analyzeLocalChapterQuery("members joined in 2020", snap);
    expect(reply).toContain("Veteran Vera");
    expect(reply).not.toContain("Fresh Face");
  });

  it("refuses personal contact details on privacy grounds", () => {
    const reply = analyzeLocalChapterQuery("what is alice's phone number", snapshot);
    expect(reply.toLowerCase()).toContain("contact details");
    expect(reply).not.toContain("Chapter AI Overview");
  });

  it("looks up possessive, case-varied and buried names", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" })],
    };
    expect(analyzeLocalChapterQuery("Amit's performance", snap)).toContain(
      "Member Record: Amit Gupta",
    );
    expect(analyzeLocalChapterQuery("  AMIT   GUPTA  ", snap)).toContain(
      "Member Record: Amit Gupta",
    );
    expect(analyzeLocalChapterQuery("Amit Gupta?", snap)).toContain(
      "Member Record: Amit Gupta",
    );
    expect(
      analyzeLocalChapterQuery(
        "I want to know how Amit Gupta is performing this month and whether his renewal is on track",
        snap,
      ),
    ).toContain("Member Record: Amit Gupta");
  });

  it("matches names with apostrophes and hyphens", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Raj D'Souza" }), member({ name: "Mary-Kate Olsen" })],
    };
    expect(analyzeLocalChapterQuery("dsouza details", snap)).toContain(
      "Member Record: Raj D'Souza",
    );
    expect(analyzeLocalChapterQuery("Mary-Kate Olsen", snap)).toContain(
      "Member Record: Mary-Kate Olsen",
    );
  });

  it("disambiguates duplicate full names", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Amit Gupta", industry: "Finance" }),
        member({ name: "Amit Gupta", industry: "Legal" }),
      ],
    };
    expect(analyzeLocalChapterQuery("show me amit gupta", snap)).toContain(
      "Multiple members match",
    );
  });

  it("keeps MC Discussion and Member Discussion stages apart", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Mackenzie Cole", renewalStage: "MC Discussion" }),
        member({ name: "Pamela Porter", renewalStage: "Member Discussion" }),
      ],
    };
    const mc = analyzeLocalChapterQuery("mc discussion members", snap);
    expect(mc).toContain("Mackenzie Cole");
    expect(mc).not.toContain("Pamela Porter");
    const mem = analyzeLocalChapterQuery("member discussion", snap);
    expect(mem).toContain("Pamela Porter");
    expect(mem).not.toContain("Mackenzie Cole");
  });

  it("routes tell-me and status phrasings to the pipeline", () => {
    expect(analyzeLocalChapterQuery("tell me about renewals", snapshot)).toContain(
      "Renewal Pipeline",
    );
    expect(analyzeLocalChapterQuery("payment status", snapshot)).toContain("Renewal Pipeline");
    const docs: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Don Dover", renewalStage: "Documents Pending" })],
    };
    const pending = analyzeLocalChapterQuery("documents pending", docs);
    expect(pending).toContain("Don Dover");
    expect(pending).toContain("Documents Pending");
  });

  it("lists members for every directory phrasing", () => {
    for (const q of ["list members", "show members", "all members", "members"]) {
      expect(analyzeLocalChapterQuery(q, snapshot)).toContain("Full Member Directory");
    }
  });

  it("answers upcoming and week-window renewal queries", () => {
    const in5 = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const in10 = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Nina Near",
          renewalDate: in5,
          renewalStatus: "active",
          renewalStage: "normal",
        }),
        member({
          name: "Wendy Weeks",
          renewalDate: in10,
          renewalStatus: "active",
          renewalStage: "normal",
        }),
      ],
    };
    expect(analyzeLocalChapterQuery("upcoming renewals", snap)).toContain("Nina Near");
    expect(analyzeLocalChapterQuery("due in the next 2 weeks", snap)).toContain("Wendy Weeks");
  });

  it("treats today as upcoming, not overdue", () => {
    const today = new Date().toISOString().slice(0, 10);
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Tara Today",
          renewalDate: today,
          renewalStatus: "active",
          renewalStage: "normal",
        }),
      ],
    };
    expect(analyzeLocalChapterQuery("overdue renewals", snap)).toContain(
      "No renewals are overdue",
    );
    expect(analyzeLocalChapterQuery("renewals due today", snap)).toContain("Tara Today");
  });

  it("answers empty states honestly across branches", () => {
    const bare: ChatSnapshot = {
      ...snapshot,
      members: [
        member({
          name: "Solo Sam",
          isCommittee: false,
          latestColor: "grey",
          latestScore: null,
          palmsTyfcb: 0,
          palmsReferrals: 0,
          palmsOneToOne: 0,
          palmsCeu: 0,
          palmsVisitors: 0,
          renewalDate: null,
          renewalStage: null,
          renewalStatus: "active",
          openTaskCount: 0,
          lifetimeSponsors: 0,
          lifetimeTrainings: 0,
          pastRoles: [],
          memberSince: null,
        }),
      ],
      summary: {
        ...snapshot.summary,
        memberCount: 1,
        committeeCount: 0,
        greenCount: 0,
        amberCount: 0,
        redCount: 0,
        greyCount: 1,
        totalTyfcb: 0,
      },
    };
    expect(analyzeLocalChapterQuery("tyfcb", bare)).toContain("No TYFCB data");
    expect(analyzeLocalChapterQuery("red members", bare)).toContain("Great news");
    expect(analyzeLocalChapterQuery("committee", bare)).toContain("No committee members");
    expect(analyzeLocalChapterQuery("past roles", bare)).toContain("No past leadership roles");
    expect(analyzeLocalChapterQuery("achievements", bare)).toContain("Total Sponsorships:* 0");
    expect(analyzeLocalChapterQuery("slipped from green", bare)).toContain("Nobody slipped");
    expect(analyzeLocalChapterQuery("most 1-to-1s", bare)).toContain("No 1-to-1 activity");
    expect(analyzeLocalChapterQuery("newest members", bare)).toContain("No join dates");
    expect(analyzeLocalChapterQuery("open tasks", bare)).toContain("No open renewal tasks");
    expect(analyzeLocalChapterQuery("overdue renewals", bare)).toContain(
      "No renewals are overdue",
    );
    expect(analyzeLocalChapterQuery("members joined in 1999", bare)).toContain(
      "No members joined in 1999",
    );
  });

  it("answers empty green, amber and grey audits", () => {
    const noGreen: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Ruby Red", latestColor: "red", latestScore: 30 })],
    };
    expect(analyzeLocalChapterQuery("green members", noGreen)).toContain(
      "No members are currently in the Green Zone",
    );
    const noAmber: ChatSnapshot = {
      ...snapshot,
      members: [
        member({ name: "Greta Green", latestColor: "green", latestScore: 95 }),
        member({ name: "Ruby Red", latestColor: "red", latestScore: 30 }),
      ],
    };
    expect(analyzeLocalChapterQuery("amber members", noAmber)).toContain(
      "No members are currently in the Amber Zone",
    );
    expect(analyzeLocalChapterQuery("grey zone", snapshot)).toContain(
      "Every member has a scored report",
    );
  });

  it("compares with versus and falls back gracefully without identity", () => {
    expect(analyzeLocalChapterQuery("alice versus bob", snapshot)).toContain(
      "Member Comparison",
    );
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" })],
    };
    expect(analyzeLocalChapterQuery("compare me and amit", snap)).toContain(
      "Member Record: Amit Gupta",
    );
  });

  it("handles default and ambiguous identities", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" })],
    };
    const def = analyzeLocalChapterQuery("my renewal status", snap, "Member");
    expect(def).toContain("couldn't tell which member you are");
    expect(def).not.toContain("signed in as");
    const dual: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Amit Sharma" })],
    };
    expect(analyzeLocalChapterQuery("my renewal status", dual, "Amit")).toContain(
      "matches several members",
    );
  });

  it("answers zone-flavored self queries with the member record", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta", latestColor: "green" })],
    };
    const reply = analyzeLocalChapterQuery("am i in the red zone", snap, "Amit Gupta");
    expect(reply).toContain("Member Record: Amit Gupta");
    expect(reply).toContain("green Zone");
  });

  it("prefers leaderboard metrics over zone words", () => {
    expect(analyzeLocalChapterQuery("referral leaders", snapshot)).toContain("Referral Leaders");
    expect(analyzeLocalChapterQuery("one to one leaders", snapshot)).toContain("1-to-1 Leaders");
    expect(analyzeLocalChapterQuery("ceu leaders", snapshot)).toContain("CEU Leaders");
    expect(analyzeLocalChapterQuery("visitor leaders", snapshot)).toContain("Visitor Leaders");
    expect(analyzeLocalChapterQuery("referrals", snapshot)).toContain("Referral Leaders");
    expect(analyzeLocalChapterQuery("top 121", snapshot)).toContain("1-to-1 Leaders");
  });

  it("greets day-part and casual variants", () => {
    for (const q of ["good morning", "hey there", "what can you do", "who are you"]) {
      expect(analyzeLocalChapterQuery(q, snapshot)).toContain(
        "What would you like me to look up",
      );
    }
  });

  it("falls back gracefully on bare acknowledgements", () => {
    expect(analyzeLocalChapterQuery("yes", snapshot)).toContain("Chapter AI Overview");
    expect(analyzeLocalChapterQuery("   ", snapshot)).toContain("Chapter AI Overview");
  });

  it("says so honestly when a looked-up name matches nobody", () => {
    const snap: ChatSnapshot = {
      ...snapshot,
      members: [member({ name: "Amit Gupta" }), member({ name: "Amit Sharma" })],
    };
    const reply = analyzeLocalChapterQuery("Nikhil verma details", snap);
    expect(reply).toContain("couldn't find a member");
    expect(reply).not.toContain("Chapter AI Overview");
  });
});