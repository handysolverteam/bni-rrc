import { describe, expect, it } from "vitest";
import { buildMemberNameResolver, matchRowsByMemberName } from "../lib/renewals/member-aliases";
import { normalizeImportKey } from "../lib/renewals/import";
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

  it("normalizes punctuation variants to the same key", () => {
    expect(normalizeImportKey("Dr. Hemesh Thakur")).toBe("dr hemesh thakur");
    expect(normalizeImportKey("Dr Hemesh Thakur")).toBe("dr hemesh thakur");
    expect(normalizeImportKey("Mary-Kate Olsen")).toBe("mary kate olsen");
    expect(normalizeImportKey("Raj D'Souza")).toBe("raj dsouza");
    expect(normalizeImportKey("  Multiple   Spaces  ")).toBe("multiple spaces");
  });

  it("strips PDF control characters instead of failing the match", () => {
    expect(normalizeImportKey("Nitin Sharma￾Chef")).toBe("nitin sharma chef");
  });

  it("matches punctuation variants of the stored member name", () => {
    const roster: Member[] = [
      { ...members[0], id: "m1", name: "Dr. Hemesh Thakur" },
      { ...members[0], id: "m2", name: "Mary-Kate Olsen" },
      { ...members[0], id: "m3", name: "Nitin Sharma- Chef" },
    ];
    const resolve = buildMemberNameResolver(roster, []);
    expect(resolve("Dr Hemesh Thakur").map((m) => m.id)).toEqual(["m1"]);
    expect(resolve("Mary Kate Olsen").map((m) => m.id)).toEqual(["m2"]);
    expect(resolve("Nitin Sharma￾Chef").map((m) => m.id)).toEqual(["m3"]);
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
