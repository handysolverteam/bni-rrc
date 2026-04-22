import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPalmsReportIdentity,
  matchPalmsRowMembers,
  parsePalmsChapterSummaryReport,
} from "../lib/renewals/palms-import";

const sampleReport =
  "C:\\Users\\rahul\\Downloads\\Chapter_Summary_PALMS_Report_21-04-2026_10-59_AM.xls";

describe("parsePalmsChapterSummaryReport", () => {
  const sampleReportTest = existsSync(sampleReport) ? it : it.skip;

  sampleReportTest("extracts report metadata and member rows from the provided sample report", () => {
    expect(existsSync(sampleReport)).toBe(true);

    const parsed = parsePalmsChapterSummaryReport(readFileSync(sampleReport, "utf8"));

    expect(parsed.chapterName).toBe("Influencers");
    expect(parsed.reportFrom).toBe("2015-10-01");
    expect(parsed.reportTo).toBe("2026-03-31");
    expect(parsed.runAt).toBe("2026-04-21T05:29:34.000Z");
    expect(parsed.rows[0]).toMatchObject({
      firstName: "Garima",
      lastName: "Agarwal",
      name: "Garima Agarwal",
      presentCount: 93,
      absentCount: 0,
      referralsGivenInside: 84,
      referralsGivenOutside: 44,
      visitors: 18,
      oneToOnes: 163,
      tyfcb: 4130635,
      ceu: 19,
      trainings: 8,
    });
  });

  it("matches rows to members by normalized full name", () => {
    const rows = [
      {
        firstName: "Garima",
        lastName: "Agarwal",
        name: "Garima Agarwal",
        presentCount: 1,
        absentCount: 0,
        lateCount: 0,
        medicalCount: 0,
        substituteCount: 0,
        referralsGivenInside: 0,
        referralsGivenOutside: 0,
        referralsReceivedInside: 0,
        referralsReceivedOutside: 0,
        visitors: 0,
        oneToOnes: 0,
        tyfcb: null,
        ceu: 0,
        trainings: 0,
      },
    ];

    const matched = matchPalmsRowMembers(rows, [{ name: "  garima   agarwal " }]);

    expect(matched[0].matches).toHaveLength(1);
  });

  sampleReportTest("builds a stable report identity from the chapter and report window", () => {
    const parsed = parsePalmsChapterSummaryReport(readFileSync(sampleReport, "utf8"));

    expect(buildPalmsReportIdentity(parsed)).toBe("Influencers|2015-10-01|2026-03-31");
  });
});
