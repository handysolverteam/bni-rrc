import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePalmsReportWindow } from "../lib/renewals/palms-database-import";
import {
  buildPalmsReportIdentity,
  matchPalmsRowMembers,
  parsePalmsChapterSummaryReport,
  type ParsedPalmsReport,
} from "../lib/renewals/palms-import";

const sampleReport =
  "C:\\Users\\rahul\\Downloads\\Chapter_Summary_PALMS_Report_21-04-2026_10-59_AM.xls";
const julyMonthlyReport =
  "C:\\Users\\rahul\\Downloads\\Chapter_Summary_PALMS_Report_04-08-2026_7-06_PM.xls";

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

  const julyMonthlyReportTest = existsSync(julyMonthlyReport) ? it : it.skip;

  julyMonthlyReportTest("recognizes the August 4 export as the July monthly PALMS report", () => {
    const parsed = parsePalmsChapterSummaryReport(readFileSync(julyMonthlyReport, "utf8"));

    expect(parsed.chapterName).toBe("Influencers");
    expect(parsed.reportFrom).toBe("2026-07-01");
    expect(parsed.reportTo).toBe("2026-07-31");
    expect(() => validatePalmsReportWindow(parsed, "monthly")).not.toThrow();
  });
});

describe("parsePalmsChapterSummaryReport robustness", () => {
  const HEADERS = [
    "First Name", "Last Name", "P", "A", "L", "M", "S", "RGI", "RGO",
    "RRI", "RRO", "V", "1-2-1", "TYFCB", "CEU", "T",
  ];

  function reportXml(dataRow: string[], opts?: { headers?: string[]; worksheet?: string }): string {
    const cell = (value: string) => `<Cell><Data ss:Type="String">${value}</Data></Cell>`;
    const row = (values: string[]) => `<Row>${values.map(cell).join("")}</Row>`;
    // Title values sit away from the name columns (as in real exports) so
    // title rows never parse as member rows.
    const titleRow = (label: string, value: string) =>
      `<Row>${cell(label)}<Cell ss:Index="5"><Data ss:Type="String">${value}</Data></Cell></Row>`;
    const table = [
      titleRow("Chapter:", "Influencers"),
      titleRow("From:", "14-04-2026"),
      titleRow("To:", "13/05/2026"),
      row(opts?.headers ?? HEADERS),
      row(dataRow),
    ].join("");
    const nameAttr = opts?.worksheet ?? 'ss:Name="Report"';
    return `<?xml version="1.0"?><Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ${nameAttr}><Table>${table}</Table></Worksheet></Workbook>`;
  }

  function memberRow(overrides: string[]): string[] {
    const base = ["Amit", "Gupta", "1", "0", "0", "0", "0", "1", "2", "0", "0", "3", "4", "500", "5", "6"];
    overrides.forEach((value, index) => {
      base[2 + index] = value;
    });
    return base;
  }

  it("treats dash numeric cells as zero instead of failing", () => {
    const parsed = parsePalmsChapterSummaryReport(reportXml(memberRow(["-"])));
    expect(parsed.rows[0]?.presentCount).toBe(0);
  });

  it("strips currency symbols from TYFCB", () => {
    const base = ["Amit", "Gupta", "1", "0", "0", "0", "0", "1", "2", "0", "0", "3", "4", "₹1,200.00", "5", "6"];
    expect(parsePalmsChapterSummaryReport(reportXml(base)).rows[0]?.tyfcb).toBe(1200);
    const rs = [...base];
    rs[13] = "Rs. 500";
    expect(parsePalmsChapterSummaryReport(reportXml(rs)).rows[0]?.tyfcb).toBe(500);
  });

  it("decodes numeric XML entities in names", () => {
    const parsed = parsePalmsChapterSummaryReport(
      reportXml(["D&#39;Souza", "Patel", "1", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "", "0", "0"]),
    );
    expect(parsed.rows[0]?.name).toBe("D'Souza Patel");
  });

  it("parses day-first report dates", () => {
    const parsed = parsePalmsChapterSummaryReport(reportXml(memberRow(["1"])));
    expect(parsed.reportFrom).toBe("2026-04-14");
    expect(parsed.reportTo).toBe("2026-05-13");
  });

  it("matches lowercase headers", () => {
    const parsed = parsePalmsChapterSummaryReport(
      reportXml(memberRow(["1"]), { headers: HEADERS.map((h) => h.toLowerCase()) }),
    );
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.name).toBe("Amit Gupta");
  });

  it("accepts a Report worksheet without the ss: prefix", () => {
    const parsed = parsePalmsChapterSummaryReport(
      reportXml(memberRow(["1"]), { worksheet: 'Name="Report"' }),
    );
    expect(parsed.rows).toHaveLength(1);
  });
});

describe("validatePalmsReportWindow", () => {
  const baseReport: ParsedPalmsReport = {
    chapterName: "Influencers",
    reportFrom: "2015-10-01",
    reportTo: "2026-03-31",
    runAt: null,
    rows: [],
  };

  it("accepts broad PALMS windows for lifetime imports", () => {
    expect(() => validatePalmsReportWindow(baseReport, "lifetime")).not.toThrow();
  });

  it("rejects broad PALMS windows for monthly imports", () => {
    expect(() => validatePalmsReportWindow(baseReport, "monthly")).toThrow(
      "This PALMS file is not a single calendar month.",
    );
  });

  it("rejects exact monthly PALMS windows for lifetime imports", () => {
    expect(() =>
      validatePalmsReportWindow(
        {
          ...baseReport,
          reportFrom: "2026-04-01",
          reportTo: "2026-04-30",
        },
        "lifetime",
      ),
    ).toThrow("This is a monthly PALMS file. Use the monthly PALMS upload instead.");
  });

  it("accepts PALMS datetime values when checking monthly report windows", () => {
    expect(() =>
      validatePalmsReportWindow(
        {
          ...baseReport,
          reportFrom: "2026-07-01T00:00:00",
          reportTo: "2026-07-31T00:00:00",
        },
        "monthly",
      ),
    ).not.toThrow();
  });
});
