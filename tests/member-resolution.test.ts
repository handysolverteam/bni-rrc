import { describe, expect, it } from "vitest";
import {
  buildUnmatchedNames,
  nameSimilarity,
  parseResolutions,
  suggestMembers,
} from "../lib/renewals/member-resolution";
import { classifyPalmsRecord } from "../lib/renewals/palms-database-import";
import { classifyScoreRow } from "../lib/renewals/traffic-light-import";

const members = [
  { id: "1", name: "Shaifaly Khanna" },
  { id: "2", name: "Nitin Sharma" },
  { id: "3", name: "Amit Gupta" },
  { id: "4", name: "Rahul Wadhwa" },
];

describe("suggestMembers", () => {
  it("suggests the existing member for a one-letter typo", () => {
    expect(suggestMembers("Shaifali Khanna", members)[0]).toMatchObject({ memberId: "1" });
  });

  it("matches a name that only adds an extra word", () => {
    expect(suggestMembers("Nitin Sharma- Chef", members)[0]).toMatchObject({ memberId: "2" });
  });

  it("matches reordered words", () => {
    expect(suggestMembers("Khanna Shaifaly", members)[0]).toMatchObject({ memberId: "1" });
  });

  it("returns nothing for a genuinely new name", () => {
    expect(suggestMembers("Piyush Puri", members)).toEqual([]);
  });

  it("does not suggest a different person who shares a first name", () => {
    expect(suggestMembers("Amit Tambi", members)).toEqual([]);
  });

  it("scores identical names as 1", () => {
    expect(nameSimilarity("Amit  Gupta", "amit gupta")).toBe(1);
  });
});

describe("buildUnmatchedNames", () => {
  it("dedupes the same name across rows/files", () => {
    const result = buildUnmatchedNames(["Piyush Puri", "piyush  puri", "Annie Jain"], members);
    expect(result.map((item) => item.name)).toEqual(["Piyush Puri", "Annie Jain"]);
  });
});

describe("parseResolutions", () => {
  it("returns no decisions when nothing was sent", () => {
    expect(parseResolutions(null)).toEqual({});
    expect(parseResolutions("")).toEqual({});
  });

  it("parses create / skip / link", () => {
    expect(
      parseResolutions(
        JSON.stringify({
          a: { action: "create" },
          b: { action: "skip" },
          c: { action: "link", memberId: "m1" },
        }),
      ),
    ).toEqual({
      a: { action: "create" },
      b: { action: "skip" },
      c: { action: "link", memberId: "m1" },
    });
  });

  it("rejects malformed payloads", () => {
    expect(() => parseResolutions("not json")).toThrow();
    expect(() => parseResolutions(JSON.stringify([]))).toThrow();
    expect(() => parseResolutions(JSON.stringify({ a: { action: "delete" } }))).toThrow();
    expect(() => parseResolutions(JSON.stringify({ a: { action: "link" } }))).toThrow();
  });
});

describe("classifyScoreRow", () => {
  it("is new when the member has no score for the month", () => {
    expect(classifyScoreRow(undefined, { score: 80, color: "green" })).toBe("new");
  });

  it("is unchanged when the stored score matches", () => {
    expect(classifyScoreRow({ score: 80, color: "green" }, { score: 80, color: "green" })).toBe("unchanged");
  });

  it("overwrites when the score differs", () => {
    expect(classifyScoreRow({ score: 72, color: "green" }, { score: 80, color: "green" })).toBe("overwrite");
  });
});

describe("classifyPalmsRecord", () => {
  const record = {
    member_id: "1",
    chapter_name: "Influencers",
    report_from: "2026-09-01",
    report_to: "2026-09-30",
    run_at: null,
    present_count: 4,
    absent_count: 0,
    late_count: 0,
    medical_count: 0,
    substitute_count: 0,
    referrals_given_inside: 3,
    referrals_given_outside: 0,
    referrals_received_inside: 2,
    referrals_received_outside: 0,
    visitors: 1,
    one_to_ones: 5,
    tyfcb: 1000,
    ceu: 2,
    trainings: 1,
    import_batch_id: null,
  };

  it("is new when nothing is stored", () => {
    expect(classifyPalmsRecord(undefined, record)).toBe("new");
  });

  it("is unchanged when every figure matches (numeric strings from the DB included)", () => {
    expect(classifyPalmsRecord({ ...record, tyfcb: "1000" as unknown as number }, record)).toBe("unchanged");
  });

  it("overwrites when any figure differs", () => {
    expect(classifyPalmsRecord({ ...record, visitors: 0 }, record)).toBe("overwrite");
  });

  it("treats a missing tyfcb as zero when comparing", () => {
    expect(classifyPalmsRecord({ ...record, tyfcb: null }, { ...record, tyfcb: null })).toBe("unchanged");
  });
});
