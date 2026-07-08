import { describe, expect, it } from "vitest";
import {
  buildDesiredSponsorRecords,
  reconcileSponsorAchievementRecords,
} from "../lib/renewals/sponsor-database-import";
import type { Member, MemberSponsorAchievement } from "../lib/types";

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
];

describe("buildDesiredSponsorRecords", () => {
  it("keeps rows whose sponsor matches an imported member and skips unknown sponsors", () => {
    const result = buildDesiredSponsorRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-04-01",
        reportTo: "2026-04-22",
        runAt: "2026-04-22T12:27:42",
        rows: [
          {
            sponsorFirstName: "Pranav",
            sponsorLastName: "Agarwal",
            sponsorFullName: "Pranav Agarwal",
            totalMembersSponsored: 2,
            sponsoredFirstName: "Jasmeet",
            sponsoredLastName: "Singh",
            sponsoredFullName: "Jasmeet Singh",
            sponsoredRegion: "Gurgaon",
            sponsoredChapter: "Influencers",
            applicationDate: "2025-03-12",
          },
          {
            sponsorFirstName: "Unknown",
            sponsorLastName: "Member",
            sponsorFullName: "Unknown Member",
            totalMembersSponsored: 1,
            sponsoredFirstName: "Aman",
            sponsoredLastName: "Kapoor",
            sponsoredFullName: "Aman Kapoor",
            sponsoredRegion: "Gurgaon",
            sponsoredChapter: "Influencers",
            applicationDate: "2025-04-01",
          },
        ],
      },
      members,
      "batch-1",
    );

    expect(result.desiredRecords).toEqual([
      {
        member_id: "member-1",
        sponsored_first_name: "Jasmeet",
        sponsored_last_name: "Singh",
        sponsored_full_name: "Jasmeet Singh",
        sponsored_region: "Gurgaon",
        sponsored_chapter: "Influencers",
        application_date: "2025-03-12",
        import_batch_id: "batch-1",
      },
    ]);
    expect(result.skippedCount).toBe(1);
    expect(result.errors).toContain("Unknown Member: sponsor not found");
  });

  it("matches sponsor names after normalizing spacing and casing", () => {
    const result = buildDesiredSponsorRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-04-01",
        reportTo: "2026-04-22",
        runAt: null,
        rows: [
          {
            sponsorFirstName: "pranav",
            sponsorLastName: "   agarwal ",
            sponsorFullName: "pranav agarwal",
            totalMembersSponsored: 1,
            sponsoredFirstName: "Jasmeet",
            sponsoredLastName: "Singh",
            sponsoredFullName: "Jasmeet Singh",
            sponsoredRegion: "Gurgaon",
            sponsoredChapter: "Influencers",
            applicationDate: "2025-03-12",
          },
        ],
      },
      members,
      "batch-1",
    );

    expect(result.desiredRecords).toHaveLength(1);
    expect(result.desiredRecords[0].member_id).toBe("member-1");
  });

  it("matches sponsor names through aliases", () => {
    const result = buildDesiredSponsorRecords(
      {
        chapterName: "Influencers",
        reportFrom: "2014-04-01",
        reportTo: "2026-04-22",
        runAt: null,
        rows: [
          {
            sponsorFirstName: "Old",
            sponsorLastName: "Name",
            sponsorFullName: "Old Name",
            totalMembersSponsored: 1,
            sponsoredFirstName: "Jasmeet",
            sponsoredLastName: "Singh",
            sponsoredFullName: "Jasmeet Singh",
            sponsoredRegion: "Gurgaon",
            sponsoredChapter: "Influencers",
            applicationDate: "2025-03-12",
          },
        ],
      },
      members,
      "batch-1",
      [{ member_id: "member-1", normalized_alias_name: "old name" }],
    );

    expect(result.desiredRecords[0].member_id).toBe("member-1");
  });
});

describe("reconcileSponsorAchievementRecords", () => {
  it("adds new rows, updates changed rows, and deletes removed rows on refresh", () => {
    const existingRecords: MemberSponsorAchievement[] = [
      {
        id: "row-1",
        member_id: "member-1",
        sponsored_first_name: "Jasmeet",
        sponsored_last_name: "Singh",
        sponsored_full_name: "Jasmeet Singh",
        sponsored_region: "Old Region",
        sponsored_chapter: "Influencers",
        application_date: "2025-03-12",
        import_batch_id: "batch-old",
      },
      {
        id: "row-2",
        member_id: "member-1",
        sponsored_first_name: "Old",
        sponsored_last_name: "Member",
        sponsored_full_name: "Old Member",
        sponsored_region: "Gurgaon",
        sponsored_chapter: "Influencers",
        application_date: "2024-01-01",
        import_batch_id: "batch-old",
      },
    ];

    const plan = reconcileSponsorAchievementRecords({
      desiredRecords: [
        {
          member_id: "member-1",
          sponsored_first_name: "Jasmeet",
          sponsored_last_name: "Singh",
          sponsored_full_name: "Jasmeet Singh",
          sponsored_region: "Gurgaon",
          sponsored_chapter: "Influencers",
          application_date: "2025-03-12",
          import_batch_id: "batch-new",
        },
        {
          member_id: "member-1",
          sponsored_first_name: "Aman",
          sponsored_last_name: "Kapoor",
          sponsored_full_name: "Aman Kapoor",
          sponsored_region: "Gurgaon",
          sponsored_chapter: "Explorers",
          application_date: "2026-01-10",
          import_batch_id: "batch-new",
        },
      ],
      existingRecords,
    });

    expect(plan.deleteIds).toEqual(["row-2"]);
    expect(plan.upsertRecords).toEqual([
      {
        member_id: "member-1",
        sponsored_first_name: "Jasmeet",
        sponsored_last_name: "Singh",
        sponsored_full_name: "Jasmeet Singh",
        sponsored_region: "Gurgaon",
        sponsored_chapter: "Influencers",
        application_date: "2025-03-12",
        import_batch_id: "batch-new",
      },
      {
        member_id: "member-1",
        sponsored_first_name: "Aman",
        sponsored_last_name: "Kapoor",
        sponsored_full_name: "Aman Kapoor",
        sponsored_region: "Gurgaon",
        sponsored_chapter: "Explorers",
        application_date: "2026-01-10",
        import_batch_id: "batch-new",
      },
    ]);
  });
});
