import type { ChatOption, ChatSnapshot, ChatSnapshotMember } from "./types";
import { formatCurrency, formatDecimal } from "./format";

/**
 * Structured quick-option actions for the chat UI (mirrors the go-green Chapter AI
 * menu flow, adapted to the BNI Renewal CRM domain). Each action returns a reply
 * plus the follow-up options to render inside the AI message bubble.
 */

export interface ActionReply {
  text: string;
  options: ChatOption[];
}

const MAIN_MENU_ACTION = "MAIN_MENU";

export function getMainMenuOptions(): ChatOption[] {
  return [
    { id: "opt_pipeline", label: "🔄 Renewal Pipeline Overview", action: "QUERY_PIPELINE" },
    { id: "opt_zones", label: "🚦 Traffic Light Zones", action: "ZONE_MENU" },
    { id: "opt_exec", label: "📋 Chapter Executive Overview", action: "QUERY_EXEC" },
    { id: "opt_tyfcb", label: "💰 TYFCB Business Leaders", action: "QUERY_TYFCB" },
    { id: "opt_committee", label: "🏅 Committee & Past Roles", action: "QUERY_COMMITTEE" },
  ];
}

function mainMenuReply(text: string): ActionReply {
  return { text, options: getMainMenuOptions() };
}

function zoneMenuReply(): ActionReply {
  return {
    text: "🚦 *Traffic Light Zone Breakdown*\n\nSelect a zone to audit:",
    options: [
      { id: "opt_zone_green", label: "🟢 Green Zone Members", action: "QUERY_ZONE", payload: { zone: "green" } },
      { id: "opt_zone_amber", label: "🟡 Amber Zone Members", action: "QUERY_ZONE", payload: { zone: "amber" } },
      { id: "opt_zone_red", label: "🔴 Red Zone Members", action: "QUERY_ZONE", payload: { zone: "red" } },
      { id: "opt_zone_grey", label: "⚪ Grey / No Score Members", action: "QUERY_ZONE", payload: { zone: "grey" } },
      { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
    ],
  };
}

function stageMenuReply(snapshot: ChatSnapshot): ActionReply {
  const stages = [
    "MC Discussion",
    "Member Discussion",
    "Documents Pending",
    "Payment Pending",
    "Critical Deadline",
    "Renewed",
    "Dropped",
  ];

  return {
    text: "🔄 *Renewal Pipeline by Stage*\n\nSelect a stage to list its members:",
    options: [
      ...stages.map((stage, index) => ({
        id: `opt_stage_${index}`,
        label: `${stage} (${snapshot.members.filter((m) => m.renewalStage === stage).length})`,
        action: "QUERY_STAGE",
        payload: { stage },
      })),
      { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
    ],
  };
}

function zoneLabel(zone: unknown): string {
  const value = String(zone ?? "");
  if (value === "green") return "🟢 Green";
  if (value === "amber") return "🟡 Amber";
  if (value === "red") return "🔴 Red";
  return "⚪ Grey";
}

const ZONE_SORT_EMOJI: Record<string, string> = {
  green: "🟢",
  amber: "🟡",
  red: "🔴",
  grey: "⚪",
};

function zoneScoreLine(member: ChatSnapshotMember): string {
  if (member.latestScore == null) return "no score yet";
  return `${member.latestScore}/100 pts`;
}

function memberDetailLine(member: ChatSnapshotMember): string {
  const parts = new Set<string>();
  parts.add(zoneScoreLine(member));
  if (member.latestReportMonth) parts.add(`Report ${member.latestReportMonth}`);
  if (member.renewalStage) parts.add(`Renewal: ${member.renewalStage}`);
  if (typeof member.palmsTyfcb === "number" && member.palmsTyfcb > 0) {
    parts.add(`TYFCB ${formatCurrency(member.palmsTyfcb)}`);
  }
  return Array.from(parts).join(" | ");
}

export function resolveOptionAction(
  option: ChatOption,
  snapshot: ChatSnapshot,
): ActionReply {
  const action = option.action;
  const members = snapshot.members;

  switch (action) {
    case MAIN_MENU_ACTION:
      return mainMenuReply("🏠 *Main Menu*\n\nPlease select an analysis category below:");

    case "ZONE_MENU":
      return zoneMenuReply();

    case "QUERY_PIPELINE": {
      const stages = [
        "Critical Deadline",
        "Payment Pending",
        "Documents Pending",
        "Member Discussion",
        "MC Discussion",
      ];
      const lines = [`🔄 *Renewal Pipeline Overview (${snapshot.chapterName})*\n`];

      for (const stage of stages) {
        const stageMembers = members.filter((m) => m.renewalStage === stage);
        lines.push(
          stageMembers.length > 0
            ? `*${stage}:* ${stageMembers.map((m) => m.name).join(", ")}`
            : `*${stage}:* none in this stage`,
        );
      }

      lines.push(
        `\n*Renewed:* ${snapshot.summary.renewedCount} members`,
        `*Dropped:* ${snapshot.summary.droppedCount} members`,
        `\n💡 *Focus:* drive Payment Pending members to renewed before the Critical Deadline.`,
      );

      return {
        text: lines.join("\n"),
        options: [
          { id: "opt_stages", label: "📄 List Members by Stage", action: "STAGE_MENU" },
          { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
        ],
      };
    }

    case "STAGE_MENU":
      return stageMenuReply(snapshot);

    case "QUERY_STAGE": {
      const stage = String(option.payload?.stage ?? "");
      const stageMembers = members.filter((m) => m.renewalStage === stage);

      if (stageMembers.length === 0) {
        return mainMenuReply(`📄 *${stage}*\n\nNo members are currently in the ${stage} stage.`);
      }

      let text = `📄 *${stage} (${stageMembers.length} Members)*\n\n`;
      stageMembers.forEach((m, idx) => {
        const datePart = m.renewalDate ? `— renewal ${m.renewalDate}` : "";
        text += `${idx + 1}. *${m.name}* ${datePart}\n`;
        if (m.openTaskCount > 0) text += `   • ${m.openTaskCount} open task(s) remaining\n`;
      });

      return {
        text,
        options: [
          { id: "opt_stages", label: "📄 Back to Stages", action: "STAGE_MENU" },
          { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
        ],
      };
    }

    case "QUERY_ZONE": {
      const zone = String(option.payload?.zone ?? "");
      const zoneMembers = members.filter((m) => (m.latestColor ?? "grey") === zone);

      if (zoneMembers.length === 0) {
        return mainMenuReply(
          `${zoneLabel(zone)} Zone\n\nNo members are currently in this zone for the latest report.`,
        );
      }

      const sorted = [...zoneMembers].sort((a, b) => {
        const sa = a.latestScore ?? -1;
        const sb = b.latestScore ?? -1;
        if (zone === "red" || zone === "grey") {
          return sa - sb;
        }
        return sb - sa;
      });

      let text = `${zoneLabel(zone)} Zone Audit (${sorted.length} Members)\n\n`;
      sorted.forEach((m, idx) => {
        text += `${idx + 1}. *${m.name}* — ${memberDetailLine(m)}\n`;
      });

      let tip = "";
      if (zone === "green") tip = "\n💡 *Action:* acknowledge these top contributors in the next meeting!";
      if (zone === "red") tip = "\n💡 *Action Plan:* schedule 1-to-1 catch-ups and pair with a Green mentor this week.";
      if (zone === "amber") tip = "\n💡 *Action:* one extra 1-to-1 or CEU module elevates these members to Green.";
      if (zone === "grey") tip = "\n💡 *Action:* check for missing traffic-light snapshots before the next report.";

      return {
        text: text + tip,
        options: [
          { id: "opt_zones", label: "🚦 Back to Zones", action: "ZONE_MENU" },
          { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
        ],
      };
    }

    case "QUERY_EXEC": {
      const avg =
        snapshot.summary.averageScore != null
          ? `${formatDecimal(snapshot.summary.averageScore, 1)} / 100 pts`
          : "no scored members yet";

      const text =
        `📋 *Chapter Executive Overview* (${snapshot.chapterName})\n\n` +
        `• *Total Members:* ${snapshot.summary.memberCount}\n` +
        `• *Committee Members:* ${snapshot.summary.committeeCount}\n` +
        `• *Active Renewals:* ${snapshot.summary.activeCycles}\n` +
        `• *Renewed:* ${snapshot.summary.renewedCount} | *Dropped:* ${snapshot.summary.droppedCount}\n` +
        `• *Average Score:* ${avg}\n` +
        `• *Zone Breakdown:* 🟢 ${snapshot.summary.greenCount} | 🟡 ${snapshot.summary.amberCount} | 🔴 ${snapshot.summary.redCount} | ⚪ ${snapshot.summary.greyCount}\n` +
        `• *Total TYFCB Closed:* ${formatCurrency(snapshot.summary.totalTyfcb)}`;

      return {
        text,
        options: [
          { id: "opt_pipeline", label: "🔄 Renewal Pipeline", action: "QUERY_PIPELINE" },
          { id: "opt_zones", label: "🚦 Traffic Light Zones", action: "ZONE_MENU" },
          { id: "opt_tyfcb", label: "💰 TYFCB Leaders", action: "QUERY_TYFCB" },
          { id: "opt_main", label: "🏠 Main Menu", action: MAIN_MENU_ACTION },
        ],
      };
    }

    case "QUERY_TYFCB": {
      const withTyfcb = members
        .filter((m) => typeof m.palmsTyfcb === "number" && m.palmsTyfcb > 0)
        .sort((a, b) => (b.palmsTyfcb ?? 0) - (a.palmsTyfcb ?? 0));

      if (withTyfcb.length === 0) {
        return mainMenuReply(`💰 *TYFCB Business Breakdown*\n\nNo TYFCB data has been reported yet for ${snapshot.chapterName}.`);
      }

      let text = `💰 *TYFCB Business Leaders (${withTyfcb.length} Members)*\n\n`;
      withTyfcb.slice(0, 15).forEach((m, idx) => {
        text += `${idx + 1}. *${m.name}* — ${formatCurrency(m.palmsTyfcb)}\n`;
      });
      text += `\n📈 *Total Closed Business:* ${formatCurrency(snapshot.summary.totalTyfcb)}`;

      return {
        text,
        options: getMainMenuOptions(),
      };
    }

    case "QUERY_COMMITTEE": {
      const committee = members.filter((m) => m.isCommittee);

      if (committee.length === 0) {
        return mainMenuReply(`🏅 *Committee Members*\n\nNo committee members are currently marked in the database.`);
      }

      let text = `🏅 *Committee Members (${committee.length})*\n\n`;
      committee.forEach((m, idx) => {
        const role = m.reportRole || m.pastRoles[0] || null;
        text += `${idx + 1}. *${m.name}*${role ? ` — ${role}` : ""}\n`;
      });

      return {
        text,
        options: getMainMenuOptions(),
      };
    }

    case "COMPARE_MEMBERS": {
      const leftName = String(option.payload?.left ?? "");
      const rightName = String(option.payload?.right ?? "");
      const left = members.find((m) => m.name === leftName);
      const right = members.find((m) => m.name === rightName);

      if (!left || !right) return mainMenuReply("📊 *Member Comparison*\n\nCould not match both members in the snapshot.");

      const line = (m: ChatSnapshotMember) => {
        const zone = ZONE_SORT_EMOJI[m.latestColor ?? "grey"] ?? "⚪";
        return (
          `*${m.name}* ${zone}\n` +
          `   • Score: ${m.latestScore ?? "N/A"}/100 (${m.latestColor ?? "grey"})\n` +
          `   • TYFCB: ${formatCurrency(m.palmsTyfcb)}\n` +
          `   • 1-to-1s: ${formatDecimal(m.palmsOneToOne, 1)}/wk\n` +
          `   • CEU: ${formatDecimal(m.palmsCeu, 1)}/wk\n` +
          `   • Renewal: ${m.renewalStage ?? m.renewalStatus ?? "N/A"}${m.renewalDate ? ` (${m.renewalDate})` : ""}\n`
        );
      };

      return {
        text: `📊 *Side-by-Side Comparison* (${snapshot.chapterName})\n\n${line(left)}${line(right)}`,
        options: getMainMenuOptions(),
      };
    }

    default:
      return mainMenuReply("Select an option below:");
  }
}

export const chatActionIds = {
  mainMenu: MAIN_MENU_ACTION,
  pipeline: "QUERY_PIPELINE",
  zones: "ZONE_MENU",
  exec: "QUERY_EXEC",
  tyfcb: "QUERY_TYFCB",
  committee: "QUERY_COMMITTEE",
  compare: "COMPARE_MEMBERS",
};