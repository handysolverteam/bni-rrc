import type { ChatSnapshot, ChatSnapshotMember } from "./types";
import { formatCurrency, formatDecimal } from "./format";

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

function matchesQuery(memberName: string, lowerQuery: string): boolean {
  const fullName = memberName.toLowerCase().trim();
  if (!fullName || fullName.length < 2) return false;
  if (lowerQuery.includes(fullName)) return true;
  const parts = splitName(memberName);
  return parts.some((part) => part.length >= 3 && lowerQuery.includes(part));
}

function memberDetail(member: ChatSnapshotMember): string {
  const zone = member.latestColor ?? "grey";
  const sponsorNote = member.sponsor ? `\n• *Sponsor:* ${member.sponsor}` : "";

  return (
    `👤 *Member Record: ${member.name}*\n` +
    `• *Industry:* ${member.industry ?? "N/A"}\n` +
    `• *Committee Member:* ${member.isCommittee ? "Yes" : "No"}${member.reportRole ? ` (${member.reportRole})` : ""}` +
    sponsorNote +
    (member.memberSince ? `\n• *Member Since:* ${member.memberSince}` : "") +
    `\n\n📊 *Latest Traffic Light:* ${zoneEmoji(member)} ${member.latestScore != null ? `${member.latestScore}/100 pts` : "no score yet"} (${zone} Zone${member.latestReportMonth ? `, Report ${member.latestReportMonth}` : ""})` +
    `\n📈 *Performance:* TYFCB ${formatCurrency(member.palmsTyfcb)} | 1-to-1s ${formatDecimal(member.palmsOneToOne, 1)}/wk | CEU ${formatDecimal(member.palmsCeu, 1)}/wk | Referrals ${formatDecimal(member.palmsReferrals, 1)}/wk` +
    `\n🔄 *Renewal:* ${member.renewalStage ?? member.renewalStatus ?? "no cycle"}${member.renewalDate ? ` (${member.renewalDate})` : ""} | ${member.openTaskCount} open task(s)` +
    `\n🏅 *Achievements:* ${member.lifetimeSponsors} sponsorship(s) (${member.pastYearSponsors} past year) | ${member.lifetimeTrainings} training(s) (${member.pastYearTrainings} past year)` +
    (member.pastRoles.length > 0 ? `\n📜 *Past Roles:* ${member.pastRoles.join(", ")}` : "")
  );
}

export function analyzeLocalChapterQuery(
  prompt: string,
  snapshot: ChatSnapshot,
): string {
  const lower = (prompt || "").toLowerCase().trim();
  const members = snapshot.members;

  // 1. Compare two members
  const isComparison =
    lower.includes("compare") ||
    lower.includes(" vs ") ||
    lower.includes(" versus ") ||
    lower.includes("difference between");

  const matchedMembers = members.filter((m) => matchesQuery(m.name, lower));
  if (isComparison && matchedMembers.length >= 2) {
    const [left, right] = matchedMembers.slice(0, 2);
    return (
      `📊 *Member Comparison* (${snapshot.chapterName})\n\n` +
      `${memberDetail(left)}\n\n` +
      `${memberDetail(right)}\n\n` +
      `❓ *Would you like me to generate a 1-to-1 invitation template to pair them?*`
    );
  }

  // 2. Member lookup (single)
  if (matchedMembers.length === 1) {
    return `${memberDetail(matchedMembers[0])}\n\n❓ *Would you like me to look up another member or run a zone audit?*`;
  }

  // 3. Full member list
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

  // 4. Greetings / capabilities
  if (
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    lower.includes("what can you do") ||
    lower.includes("help") ||
    lower.includes("who are you") ||
    lower.includes("capabilities")
  ) {
    return (
      `👋 *Hello! I am Chapter AI for ${snapshot.chapterName}.*\n\n` +
      `I can help you with your chapter data:\n\n` +
      `• 🔄 *Renewal Pipeline* — who is in Critical Deadline, Payment Pending, or needs documents ("renewals", "pipeline").\n` +
      `• 🚦 *Zone Audits* — Green/Amber/Red members and their scores ("green zone", "red members").\n` +
      `• 👤 *Member Records* — ask about any member by name ("How is Rahul doing?").\n` +
      `• 📊 *Member Comparison* — compare two members side-by-side.\n` +
      `• 💰 *TYFCB Business* — revenue leaders and chapter total.\n` +
      `• 🏅 *Committee & Roles* — committee members and past leadership roles.\n` +
      `• 🏆 *Achievements* — sponsorships and trainings.\n\n` +
      `❓ *What would you like me to look up for ${snapshot.chapterName} right now?*`
    );
  }

  // 5. Renewal pipeline / stage queries
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

  // 6. Zone audits
  if (
    lower.includes("green") ||
    lower.includes("top performer") ||
    lower.includes("leader") ||
    lower.includes("best member")
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
    lower.includes("red") ||
    lower.includes("support") ||
    lower.includes("low score") ||
    lower.includes("alert") ||
    lower.includes("urgent")
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

  if (lower.includes("amber") || lower.includes("growth") || lower.includes("candidate")) {
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

  // 7. TYFCB / business
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

  // 8. Committee / roles
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

  // 9. Achievements (sponsors / trainings)
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

  // 10. Fallback summary + counter-question
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