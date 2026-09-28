import type { ChatSnapshot, ChatSnapshotMember, TrafficHistoryPoint } from "./types";
import { chatStageNames, stageMembersText } from "./actions";
import { formatCurrency, formatDecimal } from "./format";
import { formatDisplayDate, formatDisplayMonth } from "../date-format";

/**
 * Rule-based fallback engine used when the Gemini API key is missing or the call
 * fails. Mirrors the go-green localAiEngine but operates on the BNI Renewal CRM
 * snapshot (renewal stages, traffic-light zones, committee, achievements).
 */

const ZONE_EMOJI: Record<string, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  grey: "⚪",
};

function zoneEmoji(member: ChatSnapshotMember): string {
  return ZONE_EMOJI[member.latestColor ?? "grey"] ?? "⚪";
}

function memberLine(member: ChatSnapshotMember): string {
  const score = member.latestScore != null ? `${member.latestScore}/100 pts` : "no score";
  const stage = member.renewalStage ?? member.renewalStatus ?? "";
  return `*${member.name}* — ${zoneEmoji(member)} ${score}${stage ? ` (Renewal: ${stage})` : ""}`;
}

function splitName(name: string): string[] {
  return name.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Name comparison form: lowercase, no apostrophes/hyphens, so "D'Souza"
 * matches "dsouza" and "Mary-Kate" matches "mary kate".
 */
function plainName(name: string): string {
  return name.toLowerCase().replace(/['’`\-]/g, "");
}

/** Zero-activity phrasings ("who has zero 1-to-1s", "who brought no visitors"). */
function wantsNoActivity(lowerQuery: string): boolean {
  return (
    lowerQuery.includes("zero") ||
    lowerQuery.includes("no ") ||
    lowerQuery.includes("none") ||
    lowerQuery.includes("without") ||
    lowerQuery.includes("never")
  );
}

function parseIsoDate(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(time) ? null : time;
}

function startOfTodayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function isLiveRenewal(member: ChatSnapshotMember): boolean {
  return member.renewalStatus !== "renewed" && member.renewalStatus !== "dropped";
}

function colorLabel(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

function trendLine(history: TrafficHistoryPoint[]): string {
  return history
    .map(
      (p) =>
        `${p.month ? formatDisplayMonth(p.month) : "?"} ${p.score ?? "?"} (${colorLabel(p.color)})`,
    )
    .join(" → ");
}

/** Consecutive grey reports at the newest end of the history. */
function greyStreak(history: TrafficHistoryPoint[]): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i]?.color ?? "grey") === "grey") count += 1;
    else break;
  }
  return count;
}

/** Green somewhere in history but currently off-green. */
function slippedFromGreen(history: TrafficHistoryPoint[]): boolean {
  if (history.length < 2) return false;
  const latest = history[history.length - 1];
  if ((latest?.color ?? "grey") === "green") return false;
  return history.slice(0, -1).some((p) => (p.color ?? "grey") === "green");
}

function matchesQuery(memberName: string, lowerQuery: string): boolean {
  const fullName = plainName(memberName).trim();
  if (!fullName || fullName.length < 2) return false;
  const plainQuery = plainName(lowerQuery);
  if (plainQuery.includes(fullName)) return true;
  const parts = splitName(memberName).map((part) => plainName(part));
  return parts.some((part) => part.length >= 3 && plainQuery.includes(part));
}

function memberDetail(member: ChatSnapshotMember): string {
  const zone = member.latestColor ?? "grey";
  const sponsorNote = member.sponsor ? `\n• *Sponsor:* ${member.sponsor}` : "";
  const streak = greyStreak(member.trafficHistory);
  const streakNote =
    zone === "grey" && streak >= 2
      ? ` | ⚪ Grey for ${streak} consecutive reports`
      : "";

  return (
    `👤 *Member Record: ${member.name}*\n` +
    `• *Industry:* ${member.industry ?? "N/A"}\n` +
    `• *Committee Member:* ${member.isCommittee ? "Yes" : "No"}${member.reportRole ? ` (${member.reportRole})` : ""}` +
    sponsorNote +
    (member.memberSince ? `\n• *Member Since:* ${member.memberSince}` : "") +
    `\n\n📊 *Latest Traffic Light:* ${zoneEmoji(member)} ${member.latestScore != null ? `${member.latestScore}/100 pts` : "no score yet"} (${zone} Zone${member.latestReportMonth ? `, Report ${member.latestReportMonth}` : ""})${streakNote}` +
    (member.trafficHistory.length > 0
      ? `\n📉 *Trend:* ${trendLine(member.trafficHistory)}`
      : "") +
    `\n📈 *Performance:* TYFCB ${formatCurrency(member.palmsTyfcb)} | 1-to-1s ${formatDecimal(member.palmsOneToOne, 1)}/wk | CEU ${formatDecimal(member.palmsCeu, 1)}/wk | Referrals ${formatDecimal(member.palmsReferrals, 1)}/wk` +
    (member.monthlyReferrals != null
      ? ` | Last month (${formatDisplayMonth(member.monthlyReportMonth)}): ${member.monthlyReferrals} given`
      : "") +
    `\n🔄 *Renewal:* ${member.renewalStage ?? member.renewalStatus ?? "no cycle"}${member.renewalDate ? ` (${member.renewalDate})` : ""} | ${member.openTaskCount} open task(s)` +
    `\n🏅 *Achievements:* ${member.lifetimeSponsors} sponsorship(s) (${member.pastYearSponsors} past year) | ${member.lifetimeTrainings} training(s) (${member.pastYearTrainings} past year)` +
    (member.pastRoles.length > 0 ? `\n📜 *Past Roles:* ${member.pastRoles.join(", ")}` : "")
  );
}

export function analyzeLocalChapterQuery(
  prompt: string,
  snapshot: ChatSnapshot,
  userName?: string,
): string {
  const lower = (prompt || "")
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/, "");
  const members = snapshot.members;

  // 0. Contact details are never available (privacy boundary wins over lookup).
  if (
    lower.includes("email") ||
    lower.includes("phone") ||
    lower.includes("contact") ||
    lower.includes("mobile")
  ) {
    return (
      `🔒 *Contact details aren't something I can share.*\n\n` +
      `I don't have access to members' personal phone numbers, email addresses or other contact details — and I never display them in chat.\n\n` +
      `❓ *Want a member's renewal or performance record instead? Just ask by name.*`
    );
  }

  const matchedMembers = members.filter((m) => matchesQuery(m.name, lower));
  const exactMatches = members.filter((m) => {
    const fullName = plainName(m.name).trim();
    return fullName.length >= 2 && plainName(lower).includes(fullName);
  });

  // 0b. Self reference ("my renewal", "how am i doing") resolves against the
  // signed-in display name. A named member in the same query wins ("my friend
  // Alice" looks up Alice, not you).
  const selfName = plainName(userName || "").trim();
  const plainSelf = selfName;
  const selfCandidates =
    plainSelf && plainSelf !== "member"
      ? members.filter((m) => {
          const full = plainName(m.name).trim();
          if (full.length < 2) return false;
          if (plainSelf.includes(full)) return true;
          return full
            .split(/\s+/)
            .some((part) => part.length >= 3 && plainSelf.includes(part));
        })
      : [];
  const self =
    selfCandidates.length === 1 ? selfCandidates[0] : undefined;
  const selfRef =
    /\b(my|mine|myself)\b/.test(lower) ||
    lower.includes("about me") ||
    lower.includes("for me") ||
    /\bam i\b/.test(lower);
  const selfWords = selfRef || /\b(me|i)\b/.test(lower);

  // 1. Compare two members ("compare A and B", "A vs B", "A and B"). "Me"
  // resolves to the signed-in member.
  const isComparison =
    lower.includes("compare") ||
    lower.includes(" vs ") ||
    lower.includes(" versus ") ||
    lower.includes("difference between") ||
    lower.includes("v/s") ||
    /\bvs\.?\b/.test(lower);
  const pairWords =
    lower.includes(" and ") ||
    lower.includes(",") ||
    lower.includes(" & ") ||
    lower.includes(" plus ") ||
    lower.includes(" with ");
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const comparePool = [...matchedMembers];
  if (selfWords && self && !comparePool.includes(self)) comparePool.push(self);
  const isPair =
    !isComparison &&
    pairWords &&
    (exactMatches.length === 2 || (comparePool.length === 2 && wordCount <= 4));
  if ((isComparison || isPair) && comparePool.length >= 2) {
    const [left, right] = (
      isPair && exactMatches.length === 2 ? exactMatches : comparePool
    ).slice(0, 2);
    if (left && right) {
      return (
        `📊 *Member Comparison* (${snapshot.chapterName})\n\n` +
        `${memberDetail(left)}\n\n` +
        `${memberDetail(right)}\n\n` +
        `❓ *Would you like me to generate a 1-to-1 invitation template to pair them?*`
      );
    }
  }

  // 1b. Self lookup when no named member matched.
  if (selfRef && matchedMembers.length === 0) {
    if (self) {
      return `${memberDetail(self)}\n\n❓ *Anything else about your record, or shall I look up another member?*`;
    }
    if (selfCandidates.length > 1) {
      let res = `👥 *Your account ("${(userName || "").trim()}") matches several members:*\n\n`;
      selfCandidates.slice(0, 10).forEach((m, idx) => {
        res += `${idx + 1}. ${memberLine(m)}\n`;
      });
      return res + `\n❓ *Please reply with your full name.*`;
    }
    const signedIn =
      selfName && selfName !== "member" ? ` (signed in as "${(userName || "").trim()}")` : "";
    return (
      `🔍 *I couldn't tell which member you are${signedIn}.*\n\n` +
      `Reply with your full name and I'll pull up your record.\n\n` +
      `❓ *Want the full member directory instead?*`
    );
  }

  // 2. Member lookup (single). Prefer an exact full-name hit: with dozens of
  // members, shared first/last names are common, and the exact hit must win
  // over partial matches ("amit gupta details" with two Amits still resolves).
  const single =
    exactMatches.length === 1
      ? exactMatches[0]
      : matchedMembers.length === 1
        ? matchedMembers[0]
        : undefined;
  if (single) {
    return `${memberDetail(single)}\n\n❓ *Would you like me to look up another member or run a zone audit?*`;
  }

  // 2b. Ambiguous name: list the candidates instead of silently falling
  // through to the generic chapter overview.
  const ambiguous = exactMatches.length > 1 ? exactMatches : matchedMembers;
  if (ambiguous.length > 1) {
    let res = `👥 *Multiple members match "${prompt.trim()}" (${ambiguous.length})*\n\n`;
    ambiguous.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. ${memberLine(m)}\n`;
    });
    return res + `\n❓ *Please reply with the full name of the member you want.*`;
  }

  // 3. Industry filter ("members in Commercial Real Estate")
  const industries = Array.from(
    new Set(
      members
        .map((m) => m.industry)
        .filter((industry): industry is string => Boolean(industry)),
    ),
  );
  const matchedIndustry = industries.find((industry) =>
    lower.includes(industry.toLowerCase()),
  );
  if (matchedIndustry) {
    const inIndustry = members
      .filter((m) => m.industry === matchedIndustry)
      .sort((a, b) => a.name.localeCompare(b.name));
    let res = `🏢 *Members in ${matchedIndustry} (${inIndustry.length})*\n\n`;
    inIndustry.forEach((m, idx) => {
      res += `${idx + 1}. ${memberLine(m)}\n`;
    });
    return res + `\n❓ *Want a specific member's full record?*`;
  }

  // 4. Full member list
  if (
    lower.includes("member list") ||
    lower.includes("list members") ||
    lower.includes("all members") ||
    lower.includes("show members") ||
    lower === "members"
  ) {
    let res = `📋 *Full Member Directory (${members.length} Members)*\n\n`;
    members.forEach((m, idx) => {
      res += `${idx + 1}. ${memberLine(m)}\n`;
    });
    res += `\n❓ *Would you like a specific member's full record or a zone audit?*`;
    return res;
  }

  // 5. Specific stage request — answer only that stage, not the whole pipeline.
  const requestedStage = chatStageNames.find((stage) =>
    lower.includes(stage.toLowerCase()),
  );
  if (requestedStage) {
    return (
      stageMembersText(snapshot, requestedStage) +
      `\n❓ *Want another stage or a specific member's full record?*`
    );
  }

  // 5b. Reversed stage phrasing ("pending documents", "document status").
  if (lower.includes("document")) {
    return (
      stageMembersText(snapshot, "Documents Pending") +
      `\n❓ *Want another stage or a specific member's full record?*`
    );
  }

  // 6. Two-year renewal terms (before the pipeline branch: the query contains "renewal")
  if (
    lower.includes("2-year") ||
    lower.includes("2 year") ||
    lower.includes("two year") ||
    lower.includes("two-year")
  ) {
    const twoYear = members
      .filter((m) => m.isTwoYear)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (twoYear.length === 0) {
      return `📜 *2-Year Renewal Terms*\n\nNo members are on a 2-year renewal term.`;
    }
    let res = `📜 *2-Year Renewal Terms (${twoYear.length})*\n\n`;
    twoYear.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}*${m.renewalDate ? ` — renewal ${formatDisplayDate(m.renewalDate)}` : ""}\n`;
    });
    return res + `\n❓ *Want the payment status for any of these members?*`;
  }

  // 7. Open-tasks leaderboard
  if (
    lower.includes("open task") ||
    lower.includes("most task") ||
    lower.includes("pending task") ||
    lower.includes("task load") ||
    lower === "tasks" ||
    lower.includes("all tasks") ||
    lower.includes("show tasks") ||
    lower.includes("task list")
  ) {
    const withOpen = members
      .filter((m) => m.openTaskCount > 0)
      .sort((a, b) => b.openTaskCount - a.openTaskCount);
    if (withOpen.length === 0) {
      return `✅ *Open Renewal Tasks*\n\nNo open renewal tasks right now — everything is done! 🎉`;
    }
    let res = `📝 *Most Open Tasks (${withOpen.length} member${withOpen.length === 1 ? "" : "s"} have open work)*\n\n`;
    withOpen.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${m.openTaskCount} open task(s)${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
    });
    return res + `\n❓ *Want the full task list for any of these members?*`;
  }

  // 8. Overdue renewals (renewal date crossed, still not renewed/dropped)
  if (lower.includes("overdue")) {
    const today = startOfTodayUtc();
    const overdue = members
      .filter((m) => {
        if (!isLiveRenewal(m)) return false;
        const t = parseIsoDate(m.renewalDate);
        return t != null && t < today;
      })
      .sort((a, b) => String(a.renewalDate).localeCompare(String(b.renewalDate)));
    if (overdue.length === 0) {
      return `✅ *Overdue Renewals*\n\nNo renewals are overdue — nothing has crossed its renewal date.`;
    }
    let res = `⏰ *Overdue Renewals (${overdue.length})*\n\n`;
    overdue.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — renewal was ${formatDisplayDate(m.renewalDate)} (${m.openTaskCount} open task(s))\n`;
    });
    return res + `\n❓ *Want a follow-up priority order for these members?*`;
  }

  // 9. Renewals due in a window ("due in the next 30 days", "upcoming renewals")
  if (
    lower.includes("upcoming") ||
    lower.includes("due in") ||
    lower.includes("due this") ||
    lower.includes("due next") ||
    lower.includes("due soon") ||
    lower.includes("due today") ||
    lower.includes("due tonight") ||
    lower.includes("due tomorrow")
  ) {
    let days = 60;
    const windowMatch = lower.match(/(\d+)\s*(day|week|month)/);
    if (windowMatch) {
      const count = Number(windowMatch[1]);
      days = windowMatch[2].startsWith("week")
        ? count * 7
        : windowMatch[2].startsWith("month")
          ? count * 30
          : count;
    } else if (lower.includes("due today") || lower.includes("due tomorrow")) {
      days = 1;
    }
    const today = startOfTodayUtc();
    const upcoming = members
      .filter((m) => {
        if (!isLiveRenewal(m)) return false;
        const t = parseIsoDate(m.renewalDate);
        return t != null && t >= today && t <= today + days * 86_400_000;
      })
      .sort((a, b) => String(a.renewalDate).localeCompare(String(b.renewalDate)));
    if (upcoming.length === 0) {
      return `📅 *Upcoming Renewals*\n\nNo renewals due in the next ${days} days.`;
    }
    let res = `📅 *Renewals Due in the Next ${days} Days (${upcoming.length})*\n\n`;
    upcoming.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — renewal ${formatDisplayDate(m.renewalDate)}${m.renewalStage ? ` (${m.renewalStage})` : ""}\n`;
    });
    return res + `\n❓ *Want task reminders drafted for these members?*`;
  }

  // 10. Renewal pipeline / stage queries
  if (
    lower.includes("renew") ||
    lower.includes("pipeline") ||
    lower.includes("stage") ||
    lower.includes("due") ||
    lower.includes("deadline") ||
    lower.includes("payment") ||
    lower.includes("critical")
  ) {
    const stages = [
      "Critical Deadline",
      "Payment Pending",
      "Documents Pending",
      "Member Discussion",
      "MC Discussion",
    ];
    let res = `🔄 *Renewal Pipeline (${snapshot.chapterName})*\n\n`;
    for (const stage of stages) {
      const stageMembers = members.filter((m) => m.renewalStage === stage);
      if (stageMembers.length === 0) continue;
      res += `*${stage} (${stageMembers.length})*\n`;
      stageMembers.forEach((m) => {
        res += `• *${m.name}*${m.renewalDate ? ` — renewal ${m.renewalDate}` : ""}${m.openTaskCount > 0 ? ` (${m.openTaskCount} open task(s))` : ""}\n`;
      });
      res += `\n`;
    }
    res += `*Renewed:* ${snapshot.summary.renewedCount} | *Dropped:* ${snapshot.summary.droppedCount}\n\n` +
      `❓ *Would you like to list members in a specific stage or check their documents/payment status?*`;
    return res;
  }

  // 11. TYFCB / business (before zones: "business leaders" means TYFCB, not Green)
  if (lower.includes("tyfcb") || lower.includes("business") || lower.includes("revenue") || lower.includes("money")) {
    const withTyfcb = members
      .filter((m) => typeof m.palmsTyfcb === "number" && m.palmsTyfcb > 0)
      .sort((a, b) => (b.palmsTyfcb ?? 0) - (a.palmsTyfcb ?? 0));

    if (withTyfcb.length === 0) {
      return `💰 *TYFCB Business Breakdown*\n\nNo TYFCB data has been reported for ${snapshot.chapterName} yet.`;
    }

    let res = `💰 *TYFCB Business Leaders*\n\n`;
    withTyfcb.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${formatCurrency(m.palmsTyfcb)}\n`;
    });
    res += `\n📈 *Total Closed Business:* ${formatCurrency(snapshot.summary.totalTyfcb)}\n\n` +
      `❓ *Would you like to see who passed the most referrals?*`;
    return res;
  }

  // 12. Slipped members (before zones: "slipped from green" contains zone words)
  if (
    lower.includes("slip") ||
    lower.includes("fell from") ||
    lower.includes("declin") ||
    lower.includes("went from") ||
    lower.includes("deteriorat")
  ) {
    const slipped = members.filter((m) => slippedFromGreen(m.trafficHistory));
    if (slipped.length === 0) {
      return `📉 *Slipped Members*\n\nNobody slipped from Green recently — no one with Green history is currently off-Green.`;
    }
    let res = `📉 *Slipped from Green (${slipped.length})*\n\n`;
    slipped.forEach((m, idx) => {
      const lastGreen = [...m.trafficHistory]
        .reverse()
        .find((p) => (p.color ?? "grey") === "green");
      const now = m.trafficHistory[m.trafficHistory.length - 1];
      const wasPart = lastGreen
        ? `was Green (${formatDisplayMonth(lastGreen.month)}${lastGreen.score != null ? `, ${lastGreen.score}` : ""})`
        : "was Green before";
      const nowPart = now
        ? `now ${colorLabel(now.color ?? "grey")}${now.score != null ? ` (${now.score})` : ""}`
        : "now off-Green";
      res += `${idx + 1}. *${m.name}* — ${wasPart} → ${nowPart}\n`;
    });
    return res + `\n❓ *Want a re-engagement plan for any of them?*`;
  }

  // 13. Zone audits. A leaderboard metric in the query wins over a zone word
  // ("referral leaders" means referrals, not Green).
  const hasMetricWords =
    lower.includes("referral") ||
    lower.includes("1-to-1") ||
    lower.includes("1 to 1") ||
    lower.includes("one to one") ||
    lower.includes("one-to-one") ||
    lower.includes("121") ||
    lower.includes("ceu") ||
    lower.includes("visitor");
  if (
    !hasMetricWords &&
    (lower.includes("green") ||
      lower.includes("top performer") ||
      lower.includes("leader") ||
      lower.includes("best member") ||
      lower.includes("highest score") ||
      lower.includes("best score") ||
      lower.includes("top score") ||
      lower === "best")
  ) {
    const greenMembers = members.filter((m) => m.latestColor === "green");
    if (greenMembers.length === 0) {
      return `🟢 *Green Zone Audit*\n\nNo members are currently in the Green Zone for this report.\n\n❓ *Would you like to see the Amber candidates closest to Green?*`;
    }
    let res = `🟢 *Green Zone Leaders (${greenMembers.length} Members)*\n\n`;
    const sorted = [...greenMembers].sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
    sorted.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${m.latestScore ?? "N/A"}/100 pts${typeof m.palmsTyfcb === "number" && m.palmsTyfcb > 0 ? ` | TYFCB ${formatCurrency(m.palmsTyfcb)}` : ""}\n`;
    });
    res += `\n❓ *Would you like a draft WhatsApp message to congratulate these leaders?*`;
    return res;
  }

  if (
    !hasMetricWords &&
    (lower.includes("red") ||
      lower.includes("support") ||
      lower.includes("low score") ||
      lower.includes("lowest score") ||
      lower.includes("worst score") ||
      lower.includes("worst") ||
      lower.includes("alert") ||
      lower.includes("urgent"))
  ) {
    const redMembers = members.filter((m) => m.latestColor === "red");
    if (redMembers.length === 0) {
      return `🎉 *Red Zone Audit*\n\nGreat news! ${snapshot.summary.redCount} members are currently in the Red Zone.`;
    }
    let res = `🔴 *Red Zone Support List (${redMembers.length} Members)*\n\n`;
    redMembers.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${m.latestScore ?? "N/A"}/100 pts${m.openTaskCount > 0 ? ` | ${m.openTaskCount} open task(s)` : ""}\n`;
    });
    res += `\n❓ *Would you like me to draft a 1-to-1 support invitation for these members?*`;
    return res;
  }

  if (
    !hasMetricWords &&
    (lower.includes("amber") ||
      lower.includes("yellow") ||
      lower.includes("growth") ||
      lower.includes("candidate"))
  ) {
    const amberMembers = members.filter((m) => m.latestColor === "amber");
    if (amberMembers.length === 0) {
      return `🟡 *Amber Zone Audit*\n\nNo members are currently in the Amber Zone for this report.`;
    }
    let res = `🟡 *Amber Zone Candidates (${amberMembers.length} Members)*\n\n`;
    amberMembers.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${m.latestScore ?? "N/A"}/100 pts\n`;
    });
    res += `\n❓ *Would you like a WhatsApp nudge template for these Amber members?*`;
    return res;
  }

  if (
    !hasMetricWords &&
    (lower.includes("grey") ||
      lower.includes("gray") ||
      lower.includes("no score") ||
      lower.includes("unscored"))
  ) {
    const greyMembers = members.filter((m) => (m.latestColor ?? "grey") === "grey");
    if (greyMembers.length === 0) {
      return `⚪ *Grey Zone*\n\nEvery member has a scored report — nobody is unscored.`;
    }
    let res = `⚪ *Grey Zone / No Score (${greyMembers.length} Members)*\n\n`;
    greyMembers.forEach((m, idx) => {
      const streak = greyStreak(m.trafficHistory);
      res += `${idx + 1}. *${m.name}* — ${m.latestScore != null ? `${m.latestScore}/100 pts` : "no score yet"}${streak >= 2 ? ` | Grey for ${streak} consecutive reports` : ""}${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
    });
    return res + `\n❓ *Want me to flag these for the next traffic-light report?*`;
  }

  // 13b. Overall zone breakdown ("zones", "traffic lights", "zone summary")
  if (
    lower === "zones" ||
    lower === "zone" ||
    lower.includes("zone breakdown") ||
    lower.includes("zone summary") ||
    lower.includes("all zones") ||
    lower.includes("traffic")
  ) {
    const inZone = (color: string) =>
      members
        .filter((m) => (m.latestColor ?? "grey") === color)
        .sort((a, b) => (b.latestScore ?? 0) - (a.latestScore ?? 0));
    const green = inZone("green");
    const amber = inZone("amber");
    const red = inZone("red");
    const grey = inZone("grey");
    let res =
      `🚦 *Zone Breakdown (${snapshot.chapterName})*\n\n` +
      `• 🟢 Green: ${green.length} | 🟡 Amber: ${amber.length} | 🔴 Red: ${red.length} | ⚪ Grey: ${grey.length}\n\n`;
    if (red.length > 0) {
      res += `*Needs attention (Red):*\n`;
      red.slice(0, 5).forEach((m, idx) => {
        res += `${idx + 1}. ${memberLine(m)}\n`;
      });
      res += `\n`;
    }
    return res + `❓ *Want a full audit of a specific zone (Green, Amber, Red, Grey)?*`;
  }

  // 14. Performance leaderboards (referrals, 1-to-1s, CEU, visitors)
  if (lower.includes("referral")) {
    const monthlyAsked =
      lower.includes("last month") || lower.includes("this month") || lower.includes("monthly");
    if (monthlyAsked) {
      const monthly = members
        .filter((m) => m.monthlyReferrals != null)
        .sort((a, b) => Number(b.monthlyReferrals ?? 0) - Number(a.monthlyReferrals ?? 0));
      if (monthly.length === 0) {
        return `🤝 *Referrals Last Month*\n\nNo monthly PALMS snapshot is on record yet.`;
      }
      const monthLabel = formatDisplayMonth(
        monthly.find((m) => m.monthlyReportMonth)?.monthlyReportMonth,
      );
      let res = `🤝 *Referrals Last Month (${monthLabel})*\n\n`;
      monthly.slice(0, 10).forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}* — ${Number(m.monthlyReferrals ?? 0)} given (${Number(m.monthlyReferralsReceived ?? 0)} received)\n`;
      });
      return res + `\n❓ *Want lifetime referral totals instead? Just ask.*`;
    }
    const wantsZeros =
      lower.includes("zero") ||
      lower.includes("no ") ||
      lower.includes("none") ||
      lower.includes("least") ||
      lower.includes("lowest") ||
      lower.includes("without") ||
      lower.includes("didn't") ||
      lower.includes("did not") ||
      lower.includes("never");
    const rankReceived = lower.includes("received");
    const valueOf = (m: ChatSnapshotMember) =>
      Number((rankReceived ? m.palmsReferralsReceived : m.palmsReferrals) ?? 0);
    if (wantsZeros) {
      const zeros = members
        .filter((m) => valueOf(m) === 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (zeros.length === 0) {
        return `🤝 *Referrals*\n\nEvery member has reported referrals — nobody is at zero.`;
      }
      let res = `🤝 *No Referrals ${rankReceived ? "Received" : "Reported"} (${zeros.length})*\n\n`;
      zeros.slice(0, 15).forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}*${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
      });
      return res + `\n❓ *Want a referral-generation nudge drafted for them?*`;
    }
    const ranked = [...members].sort((a, b) => valueOf(b) - valueOf(a));
    if (ranked.length === 0 || valueOf(ranked[0]) === 0) {
      return `🤝 *Referral Leaders*\n\nNo referral activity has been reported yet.`;
    }
    let res = `🤝 *Referral Leaders (${rankReceived ? "Received" : "Given"})*\n\n`;
    ranked.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${Number(m.palmsReferrals ?? 0)} given (${Number(m.palmsReferralsReceived ?? 0)} received)\n`;
    });
    return res + `\n❓ *Want to pair a top giver with someone at zero for a 1-to-1?*`;
  }

  if (
    lower.includes("1-to-1") ||
    lower.includes("1 to 1") ||
    lower.includes("one to one") ||
    lower.includes("one-to-one") ||
    lower.includes("121")
  ) {
    const valueOf = (m: ChatSnapshotMember) => Number(m.palmsOneToOne ?? 0);
    if (wantsNoActivity(lower)) {
      const zeros = members
        .filter((m) => valueOf(m) === 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (zeros.length === 0) {
        return `☕ *1-to-1s*\n\nEveryone has reported 1-to-1s — nobody is at zero.`;
      }
      let res = `☕ *No 1-to-1s Reported (${zeros.length})*\n\n`;
      zeros.slice(0, 15).forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}*${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
      });
      return res + `\n❓ *Want 1-to-1 invitation templates for them?*`;
    }
    const ranked = [...members].sort((a, b) => valueOf(b) - valueOf(a));
    if (ranked.length === 0 || valueOf(ranked[0]) === 0) {
      return `☕ *1-to-1 Leaders*\n\nNo 1-to-1 activity has been reported yet.`;
    }
    let res = `☕ *1-to-1 Leaders*\n\n`;
    ranked.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${formatDecimal(m.palmsOneToOne, 1)}/wk\n`;
    });
    return res + `\n❓ *Want 1-to-1 invitation templates for the least connected members?*`;
  }

  if (lower.includes("ceu")) {
    const valueOf = (m: ChatSnapshotMember) => Number(m.palmsCeu ?? 0);
    if (wantsNoActivity(lower)) {
      const zeros = members
        .filter((m) => valueOf(m) === 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (zeros.length === 0) {
        return `🎓 *CEU*\n\nEveryone has reported CEU — nobody is at zero.`;
      }
      let res = `🎓 *No CEU Reported (${zeros.length})*\n\n`;
      zeros.slice(0, 15).forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}*${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
      });
      return res + `\n❓ *Want to nudge them toward the next training module?*`;
    }
    const ranked = [...members].sort((a, b) => valueOf(b) - valueOf(a));
    if (ranked.length === 0 || valueOf(ranked[0]) === 0) {
      return `🎓 *CEU Leaders*\n\nNo CEU (training education) activity has been reported yet.`;
    }
    let res = `🎓 *CEU Leaders*\n\n`;
    ranked.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${formatDecimal(m.palmsCeu, 1)}/wk\n`;
    });
    return res + `\n❓ *Want to nudge members with zero CEU toward the next module?*`;
  }

  if (lower.includes("visitor")) {
    const valueOf = (m: ChatSnapshotMember) => Number(m.palmsVisitors ?? 0);
    if (wantsNoActivity(lower)) {
      const zeros = members
        .filter((m) => valueOf(m) === 0)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (zeros.length === 0) {
        return `🙌 *Visitors*\n\nEveryone has brought visitors — nobody is at zero.`;
      }
      let res = `🙌 *No Visitors Reported (${zeros.length})*\n\n`;
      zeros.slice(0, 15).forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}*${m.renewalStage ? ` (Renewal: ${m.renewalStage})` : ""}\n`;
      });
      return res + `\n❓ *Want visitor-invite templates for them?*`;
    }
    const ranked = [...members].sort((a, b) => valueOf(b) - valueOf(a));
    if (ranked.length === 0 || valueOf(ranked[0]) === 0) {
      return `🙌 *Visitor Leaders*\n\nNo visitors have been reported yet.`;
    }
    let res = `🙌 *Visitor Leaders*\n\n`;
    ranked.slice(0, 10).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — ${valueOf(m)} visitor(s)\n`;
    });
    return res + `\n❓ *Want visitor-invite templates for the next meeting?*`;
  }

  // 15. Newest / longest-tenured members
  if (
    lower.includes("newest") ||
    lower.includes("recently joined") ||
    lower.includes("new join") ||
    lower.includes("latest join") ||
    lower.includes("new member") ||
    lower.includes("join") ||
    lower.includes("tenure") ||
    lower.includes("oldest")
  ) {
    const wantsAsc =
      lower.includes("ascending") ||
      /\basc\b/.test(lower) ||
      lower.includes("oldest first") ||
      (lower.includes("chronological") && !lower.includes("reverse"));
    const wantsDesc =
      lower.includes("descending") ||
      /\bdesc\b/.test(lower) ||
      lower.includes("newest first") ||
      lower.includes("latest first") ||
      lower.includes("reverse");
    const oldestFirst =
      lower.includes("oldest") || lower.includes("longest") || (wantsAsc && !wantsDesc);
    const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : null;
    const dated = members
      .filter((m) => m.memberSince)
      .sort((a, b) =>
        oldestFirst
          ? String(a.memberSince).localeCompare(String(b.memberSince))
          : String(b.memberSince).localeCompare(String(a.memberSince)),
      );
    const listed = year
      ? dated.filter((m) => (m.memberSince ?? "").startsWith(year))
      : dated;
    if (listed.length === 0) {
      return year
        ? `🆕 *Members Joined in ${year}*\n\nNo members joined in ${year} — try another year or ask for the newest members.`
        : `🆕 *Newest Members*\n\nNo join dates are on record.`;
    }
    const title = year
      ? `🆕 *Members Joined in ${year}*`
      : oldestFirst
        ? `🕰️ *Members by Join Date (Oldest First)*`
        : `🆕 *Newest Members*`;
    let res = `${title}\n\n`;
    listed.slice(0, 5).forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}* — since ${formatDisplayDate(m.memberSince)}${m.industry ? ` (${m.industry})` : ""}\n`;
    });
    return res + `\n❓ *Want a welcome-mentor pairing for any of them?*`;
  }

  // 16. Past roles (before committee: specific former-role questions win).
  // Longest names first so "vice president" wins over "president".
  const pastRoleHit = ["vice president", "president", "secretary", "treasurer"].find((role) =>
    lower.includes(role),
  );
  if (
    lower.includes("past role") ||
    lower.includes("former") ||
    lower.includes("held") ||
    lower.includes("ex-president") ||
    pastRoleHit
  ) {
    const wantsCurrent = lower.includes("current") || lower.includes("right now");
    const holders = members
      .filter((m) => {
        if (!pastRoleHit) return m.pastRoles.length > 0;
        const inPast = m.pastRoles.some((role) =>
          role.toLowerCase().includes(pastRoleHit),
        );
        const inCurrent = (m.reportRole ?? "").toLowerCase().includes(pastRoleHit);
        if (wantsCurrent) return inCurrent;
        return inPast || inCurrent;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    if (holders.length === 0) {
      return `📜 *Past Roles*\n\nNo past leadership roles are on record.`;
    }
    const roleTitle = pastRoleHit
      ? pastRoleHit.replace(/\b\w/g, (c) => c.toUpperCase())
      : "";
    const title = pastRoleHit
      ? wantsCurrent && holders.length > 0
        ? `*Current ${roleTitle}*`
        : `*Members with ${roleTitle} experience*`
      : `*Past Leadership Roles*`;
    let res = `📜 ${title} (${holders.length})\n\n`;
    holders.forEach((m, idx) => {
      const roles = m.pastRoles.length > 0 ? m.pastRoles.join(", ") : (m.reportRole ?? "");
      res += `${idx + 1}. *${m.name}* — ${roles}\n`;
    });
    return res + `\n❓ *Want to nominate any of them for the next term?*`;
  }

  // 17. Committee / roles
  if (lower.includes("committee") || lower.includes("leadership") || lower.includes("officer") || lower.includes("role")) {
    const committee = members.filter((m) => m.isCommittee);
    if (committee.length === 0) {
      return `🏅 *Committee Members*\n\nNo committee members are currently marked in ${snapshot.chapterName}.`;
    }
    let res = `🏅 *Committee Members (${committee.length})*\n\n`;
    committee.forEach((m, idx) => {
      res += `${idx + 1}. *${m.name}*${m.reportRole ? ` — ${m.reportRole}` : ""}\n`;
    });
    res += `\n❓ *Would you like to see a member's past leadership roles?*`;
    return res;
  }

  // 18. Achievements (sponsors / trainings)
  if (
    lower.includes("sponsor") ||
    lower.includes("achievement") ||
    lower.includes("training") ||
    lower.includes("award")
  ) {
    const totalSponsors = members.reduce((sum, m) => sum + m.lifetimeSponsors, 0);
    const totalTrainings = members.reduce((sum, m) => sum + m.lifetimeTrainings, 0);
    const topSponsors = [...members]
      .sort((a, b) => b.lifetimeSponsors - a.lifetimeSponsors)
      .slice(0, 5)
      .filter((m) => m.lifetimeSponsors > 0);

    let res = `🏆 *Achievements Overview (${snapshot.chapterName})*\n\n` +
      `• *Total Sponsorships:* ${totalSponsors}\n` +
      `• *Total Trainings Attended:* ${totalTrainings}\n\n`;

    if (topSponsors.length > 0) {
      res += `*Top Sponsors:*\n`;
      topSponsors.forEach((m, idx) => {
        res += `${idx + 1}. *${m.name}* — ${m.lifetimeSponsors} sponsorship(s)\n`;
      });
    }

    return res;
  }

  // 19. Greetings / capabilities (kept near-last so real questions containing
  // "help"/"hello" still reach their content branch first)
  if (lower.includes("thank")) {
    return (
      `🙏 *You're welcome!* Glad I could help.\n\n` +
      `❓ *Is there anything else you'd like me to look up for ${snapshot.chapterName}?*`
    );
  }
  if (lower === "bye" || lower.includes("goodbye") || lower.includes("see you")) {
    return (
      `👋 *Goodbye!* I'll be here whenever you need renewal, zone or member insights for ${snapshot.chapterName}.`
    );
  }
  if (
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    /^(hi|hello|hey|good morning|good afternoon|good evening|morning|evening)\b/.test(
      lower,
    ) ||
    lower.includes("what can you do") ||
    lower.includes("help") ||
    lower.includes("who are you") ||
    lower.includes("capabilities") ||
    lower.includes("menu") ||
    lower.includes("assist") ||
    lower === "start" ||
    lower.includes("start over")
  ) {
    return (
      `👋 *Hello! I am Chapter AI for ${snapshot.chapterName}.*\n\n` +
      `I can help you with your chapter data:\n\n` +
      `• 🔄 *Renewal Pipeline* — who is in Critical Deadline, Payment Pending, or needs documents ("renewals", "pipeline").\n` +
      `• 🚦 *Zone Audits* — Green/Amber/Red/Grey members and their scores ("green zone", "red members").\n` +
      `• 👤 *Member Records* — ask about any member by name ("How is Rahul doing?").\n` +
      `• 📊 *Member Comparison* — compare two members side-by-side.\n` +
      `• 💰 *TYFCB Business* — revenue leaders and chapter total.\n` +
      `• 🏅 *Committee & Roles* — committee members and past leadership roles.\n` +
      `• 🏆 *Achievements* — sponsorships and trainings.\n\n` +
      `❓ *What would you like me to look up for ${snapshot.chapterName} right now?*`
    );
  }

  // 20. Fallback summary + counter-question. When the query clearly asks for a
  // person but no member matched, say so honestly instead of dumping the
  // generic overview (only reached when no content branch above matched).
  const looksLikeLookup =
    lower.includes("detail") ||
    lower.includes("profile") ||
    lower.includes("who is") ||
    lower.includes("tell me about") ||
    lower.includes("look up") ||
    lower.includes("lookup") ||
    /\bfind\b/.test(lower);
  if (looksLikeLookup && members.length > 0) {
    return (
      `🔍 *I couldn't find a member matching "${prompt.trim()}" in ${snapshot.chapterName}.*\n\n` +
      `Please check the spelling or reply with the member's full name. You can also ask for the *member list* to browse the directory.\n\n` +
      `❓ *Want the full member directory?*`
    );
  }
  const samples = members.slice(0, 2).map((m) => `*${m.name}*`).join(", ");
  return (
    `📊 *Chapter AI Overview for ${snapshot.chapterName}*\n` +
    `• *Members:* ${snapshot.summary.memberCount} (${snapshot.summary.committeeCount} committee)\n` +
    `• *Active Renewals:* ${snapshot.summary.activeCycles} | *Renewed:* ${snapshot.summary.renewedCount} | *Dropped:* ${snapshot.summary.droppedCount}\n` +
    `• *Average Score:* ${snapshot.summary.averageScore ?? "N/A"} / 100\n` +
    `• *Zones:* 🟢 ${snapshot.summary.greenCount} | 🟡 ${snapshot.summary.amberCount} | 🔴 ${snapshot.summary.redCount} | ⚪ ${snapshot.summary.greyCount}\n` +
    `• *Total TYFCB:* ${formatCurrency(snapshot.summary.totalTyfcb)}\n\n` +
    `💡 *I can look up any data for you. Would you like to:*\n` +
    `1. 🔄 View the *Renewal Pipeline*\n` +
    `2. 🚦 View *Zone Audits* (Green/Amber/Red)\n` +
    `3. 👤 Inspect a specific member (e.g. ${samples || "a member"})\n` +
    `4. 💰 View *TYFCB Business Leaders*\n\n` +
    `❓ *What would you like me to analyze for ${snapshot.chapterName}?*`
  );
}