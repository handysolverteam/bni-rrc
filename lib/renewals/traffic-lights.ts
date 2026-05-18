import type { TrafficLightColor } from "../types";
import * as XLSX from "xlsx";

export type ParsedTrafficLightRow = {
  name: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  medicalCount: number;
  substituteCount: number;
  referralsGiven: number;
  referralsReceived: number;
  visitors: number;
  testimonials: number;
  tyfcb: number | null;
  trainings: number;
  weekCount: number;
  score: number;
  color: TrafficLightColor;
};

export type ParsedTrafficLightReport = {
  reportMonth: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  rows: ParsedTrafficLightRow[];
  hasTyfcb: boolean;
};

export type ParsedTrafficLightScoreRow = {
  name: string;
  score: number;
  color: TrafficLightColor;
};

export type ParsedTrafficLightScoreReport = {
  reportMonth: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  rows: ParsedTrafficLightScoreRow[];
};

const monthIndexes: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

export function getTrafficLightColor(score: number): TrafficLightColor {
  if (score >= 70) {
    return "green";
  }

  if (score >= 50) {
    return "yellow";
  }

  if (score >= 30) {
    return "red";
  }

  return "grey";
}

function parseMonthToken(month: string, year: string): string {
  const monthIndex = monthIndexes[month.toLowerCase()];

  if (!monthIndex) {
    throw new Error(`Invalid traffic-light report month: ${month}`);
  }

  return `20${year}-${monthIndex}-01`;
}

function parseTrafficLightXlsxTitleMonth(title: string): string {
  const match = title.match(/\bFOR\s+([A-Z]+)\s+'?(\d{2})\b/i);

  if (!match) {
    throw new Error("Traffic-light XLSX report month was not found.");
  }

  return parseMonthToken(match[1], match[2]);
}

export function parseTrafficLightReportMonth(text: string): string {
  return parseTrafficLightReportWindow(text).reportWindowEnd;
}

export function parseTrafficLightReportWindow(text: string): {
  reportWindowStart: string;
  reportWindowEnd: string;
} {
  const match = text.match(/MEMBER TRAFFIC LIGHTS[\s\S]*?\bTO\s+([A-Z]{3})-(\d{2})/i);
  const startMatch = text.match(/MEMBER TRAFFIC LIGHTS[\s\S]*?\bFOR\s+([A-Z]{3})-(\d{2})\s+TO\s+([A-Z]{3})-(\d{2})/i);

  if (!match || !startMatch) {
    throw new Error("Traffic-light report month was not found.");
  }

  return {
    reportWindowStart: parseMonthToken(startMatch[1], startMatch[2]),
    reportWindowEnd: parseMonthToken(match[1], match[2]),
  };
}

function parseNumberToken(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return parsed;
}

function parseNumberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    return parseNumberToken(value);
  }

  throw new Error(`Invalid numeric value: ${String(value)}`);
}

function parseOptionalAmount(value: string): number | null {
  if (value.trim() === "-") {
    return null;
  }

  return parseNumberToken(value);
}

function looksLikeDataLine(line: string): boolean {
  return /\s\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+/.test(line);
}

function parseTrafficLightRow(line: string, hasTyfcb: boolean): ParsedTrafficLightRow | null {
  if (!looksLikeDataLine(line)) {
    return null;
  }

  const tokens = line.trim().split(/\s+/);
  const firstMetricIndex = tokens.findIndex((token) => /^\d+$/.test(token));

  if (firstMetricIndex <= 0) {
    return null;
  }

  const metricTokens = tokens.slice(firstMetricIndex);
  const expectedMetricCount = hasTyfcb ? 13 : 12;

  if (metricTokens.length < expectedMetricCount) {
    return null;
  }

  const name = tokens.slice(0, firstMetricIndex).join(" ");
  const [
    present,
    absent,
    late,
    medical,
    substitute,
    referralsGiven,
    referralsReceived,
    visitors,
    testimonials,
  ] = metricTokens;

  const tyfcb = hasTyfcb ? parseOptionalAmount(metricTokens[9]) : null;
  const trainingsIndex = hasTyfcb ? 10 : 9;
  const score = parseNumberToken(metricTokens[trainingsIndex + 2]);

  return {
    name,
    presentCount: parseNumberToken(present),
    absentCount: parseNumberToken(absent),
    lateCount: parseNumberToken(late),
    medicalCount: parseNumberToken(medical),
    substituteCount: parseNumberToken(substitute),
    referralsGiven: parseNumberToken(referralsGiven),
    referralsReceived: parseNumberToken(referralsReceived),
    visitors: parseNumberToken(visitors),
    testimonials: parseNumberToken(testimonials),
    tyfcb,
    trainings: parseNumberToken(metricTokens[trainingsIndex]),
    weekCount: parseNumberToken(metricTokens[trainingsIndex + 1]),
    score,
    color: getTrafficLightColor(score),
  };
}

export function parseTrafficLightReport(
  text: string,
  reportMonthOverride?: string | null,
): ParsedTrafficLightReport {
  if (!text.includes("MEMBER TRAFFIC LIGHTS")) {
    throw new Error("Only BNI Member Traffic Lights PDF reports are supported.");
  }

  const hasTyfcb = /\bTYFCB\b/.test(text);
  const reportWindow = parseTrafficLightReportWindow(text);
  const reportMonth = reportMonthOverride || reportWindow.reportWindowEnd;
  const rows = text
    .split(/\r?\n/)
    .map((line) => parseTrafficLightRow(line, hasTyfcb))
    .filter((row): row is ParsedTrafficLightRow => Boolean(row));

  if (rows.length === 0) {
    throw new Error("No traffic-light rows were found in the report.");
  }

  return {
    reportMonth,
    reportWindowStart: reportWindow.reportWindowStart,
    reportWindowEnd: reportMonthOverride || reportWindow.reportWindowEnd,
    rows,
    hasTyfcb,
  };
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function parseTrafficLightXlsxReport(
  buffer: Buffer,
  reportMonthOverride?: string | null,
): ParsedTrafficLightScoreReport {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Traffic-light XLSX workbook does not contain any sheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const title = normalizeHeader(rows[0]?.[0]);

  if (!title.includes("MEMBER TRAFFIC LIGHTS")) {
    throw new Error("Only BNI Member Traffic Lights XLSX reports are supported.");
  }

  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("Name") && headers.includes("Total Score");
  });

  if (headerRowIndex < 0) {
    throw new Error("Traffic-light XLSX headers were not found.");
  }

  const headers = rows[headerRowIndex].map(normalizeHeader);
  const nameIndex = headers.indexOf("Name");
  const scoreIndex = headers.indexOf("Total Score");
  const reportMonth = reportMonthOverride || parseTrafficLightXlsxTitleMonth(title);
  const parsedRows: ParsedTrafficLightScoreRow[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const name = normalizeHeader(row[nameIndex]);

    if (!name || name === "Name") {
      continue;
    }

    const score = parseNumberValue(row[scoreIndex]);
    parsedRows.push({
      name,
      score,
      color: getTrafficLightColor(score),
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("No traffic-light rows were found in the XLSX report.");
  }

  return {
    reportMonth,
    reportWindowStart: reportMonth,
    reportWindowEnd: reportMonth,
    rows: parsedRows,
  };
}
