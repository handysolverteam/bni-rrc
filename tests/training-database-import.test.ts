import { describe, expect, it } from "vitest";
import { buildDesiredTrainingRecords } from "../lib/renewals/training-database-import";
import type { Member } from "../lib/types";

const members: Member[] = [
  {
    id: "member-1",
    auth_user_id: null,
    name: "Pranav Agarwal",
    industry: "Finance",
    sponsor: null,
    report_role: "Member",
    member_since: null,
    is_committee: false,
  },
  {
    id: "member-2",
    auth_user_id: null,
    name: "Garima Agarwal",
    industry: "Marketing",
    sponsor: null,
    report_role: "Member",
    member_since: null,
    is_committee: false,
  },
];

describe("buildDesiredTrainingRecords", () => {
  it("keeps rows whose member matches and skips unknown members", () => {
    const result = buildDesiredTrainingRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-10-01",
        reportTo: "2026-03-31",
        runAt: "2026-04-24T17:34:24",
        rows: [
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Pranav",
            lastName: "Agarwal",
            memberName: "Pranav Agarwal",
            eventDate: "2023-08-19",
            eventType: "*Member Success Program",
            role: "Member",
            joinDate: "2023-07-01",
            inductionDate: "2023-06-21",
          },
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Unknown",
            lastName: "Member",
            memberName: "Unknown Member",
            eventDate: "2025-06-07",
            eventType: "Leadership Team Roundtable - India",
            role: null,
            joinDate: null,
            inductionDate: null,
          },
        ],
      },
      members,
      "batch-1",
    );

    expect(result.desiredRecords).toEqual([
      {
        member_id: "member-1",
        chapter_name: "Influencers",
        region_name: "Gurgaon",
        event_date: "2023-08-19",
        event_type: "*Member Success Program",
        role: "Member",
        join_date: "2023-07-01",
        induction_date: "2023-06-21",
        import_batch_id: "batch-1",
      },
    ]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toContain("Unknown Member: member not found");
  });

  it("matches member names after normalizing spacing and casing", () => {
    const result = buildDesiredTrainingRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-10-01",
        reportTo: "2026-03-31",
        runAt: null,
        rows: [
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "pranav",
            lastName: "   agarwal ",
            memberName: "pranav agarwal",
            eventDate: "2024-06-29",
            eventType: "Power Team Workshop - India",
            role: null,
            joinDate: null,
            inductionDate: null,
          },
        ],
      },
      members,
      "batch-1",
    );

    expect(result.desiredRecords).toHaveLength(1);
    expect(result.desiredRecords[0].member_id).toBe("member-1");
  });

  it("preserves overlapping historical rows by returning all desired rows for append-only upsert", () => {
    const result = buildDesiredTrainingRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-10-01",
        reportTo: "2026-03-31",
        runAt: null,
        rows: [
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Pranav",
            lastName: "Agarwal",
            memberName: "Pranav Agarwal",
            eventDate: "2023-08-19",
            eventType: "*Member Success Program",
            role: null,
            joinDate: null,
            inductionDate: null,
          },
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Pranav",
            lastName: "Agarwal",
            memberName: "Pranav Agarwal",
            eventDate: "2024-06-29",
            eventType: "Power Team Workshop - India",
            role: null,
            joinDate: null,
            inductionDate: null,
          },
        ],
      },
      members,
      "batch-2",
    );

    expect(result.desiredRecords).toHaveLength(2);
    expect(result.skippedCount).toBe(0);
  });

  it("dedupes exact duplicate attendance rows within a single file", () => {
    const result = buildDesiredTrainingRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-10-01",
        reportTo: "2026-03-31",
        runAt: null,
        rows: [
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Pranav",
            lastName: "Agarwal",
            memberName: "Pranav Agarwal",
            eventDate: "2023-08-19",
            eventType: "*Member Success Program",
            role: "Member",
            joinDate: "2023-07-01",
            inductionDate: "2023-06-21",
          },
          {
            regionName: "Gurgaon",
            chapterName: "Influencers",
            firstName: "Pranav",
            lastName: "Agarwal",
            memberName: "Pranav Agarwal",
            eventDate: "2023-08-19",
            eventType: "*Member Success Program",
            role: "Member",
            joinDate: "2023-07-01",
            inductionDate: "2023-06-21",
          },
        ],
      },
      members,
      "batch-1",
    );

    expect(result.desiredRecords).toHaveLength(1);
  });
});
