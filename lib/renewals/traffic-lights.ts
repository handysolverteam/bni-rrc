import type { TrafficLightColor } from "../types";

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

const monthIndexes: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
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
