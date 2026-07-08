import { describe, expect, it } from "vitest";
import { buildMemberNameResolver, matchRowsByMemberName } from "../lib/renewals/member-aliases";
import type { Member } from "../lib/types";

const members: Member[] = [
  {
    id: "member-1",
    auth_user_id: null,
    name: "Kunnal Gupta",
    industry: "Shutters & Awnings",
    sponsor: null,
    report_role: "Member",
    member_since: null,
    is_committee: false,
  },
  {
    id: "member-2",
    auth_user_id: null,
    name: "Komal Gupta",
    industry: "Human Resources",
    sponsor: null,
    report_role: "Member",
    member_since: null,
    is_committee: false,
  },
];

describe("member alias matching", () => {
  it("matches the current member name before checking aliases", () => {
    const resolve = buildMemberNameResolver(members, [
      { member_id: "member-2", normalized_alias_name: "kunnal gupta" },
    ]);

    expect(resolve("Kunnal Gupta").map((member) => member.id)).toEqual(["member-1"]);
  });

  it("matches an old spelling through aliases", () => {
    const resolve = buildMemberNameResolver(members, [
      { member_id: "member-1", normalized_alias_name: "kunal gupta" },
    ]);

    expect(resolve("Kunal Gupta").map((member) => member.id)).toEqual(["member-1"]);
  });

  it("returns duplicate alias matches so imports can skip ambiguous rows", () => {
    const matched = matchRowsByMemberName(
      [{ name: "K Gupta" }],
      members,
      [
        { member_id: "member-1", normalized_alias_name: "k gupta" },
        { member_id: "member-2", normalized_alias_name: "k gupta" },
      ],
    );

    expect(matched[0].matches.map((member) => member.id)).toEqual(["member-1", "member-2"]);
  });
});
