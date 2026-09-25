import { getServiceSupabase } from "../supabase/server";
import type {
  Member,
  MemberPalmsSnapshot,
  MemberSponsorAchievement,
  MemberTrafficLight,
  MemberTrainingAchievement,
  RenewalCycle,
  RenewalTask,
} from "../types";
import { selectLifetimePalmsSnapshot } from "../renewals/achievements";
import { buildSponsorAchievementSummary } from "../renewals/sponsor-achievements";
import { buildTrainingAchievementSummary } from "../renewals/training-achievements";
import { calculateStage, isWithinRenewalWorkWindow } from "../renewals/stage";
import { isActiveRenewalTaskType } from "../renewals/task-types";
import { isExactMonthlyPalmsSnapshot } from "../renewals/palms-monthly-performance";
import type {
  ChatSnapshot,
  ChatSnapshotMember,
  ChatSummary,
  TrafficHistoryPoint,
} from "./types";

function isMissingChatSchemaError(error: unknown, table: string): boolean {
  if (!error || typeof error !== "object") return false;

  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  const details =
    typeof (error as { details?: unknown }).details === "string"
      ? (error as { details: string }).details.toLowerCase()
      : "";
  const code = (error as { code?: unknown }).code;

  return code === "42P01" || (message + " " + details).includes(table);
}

const CHAPTER_FALLBACK_NAME = "BNI Chapter";

function trafficColorFromRaw(raw: string | undefined): string {
  const value = String(raw ?? "").toLowerCase();
  if (value.includes("green")) return "green";
  if (value.includes("amber") || value.includes("yellow")) return "amber";
  if (value.includes("red")) return "red";
  return "grey";
}

function colorCounts(members: ChatSnapshotMember[]): {
  greenCount: number;
  amberCount: number;
  redCount: number;
  greyCount: number;
} {
  return members.reduce(
    (acc, member) => {
      const color = member.latestColor ?? "grey";
      if (color === "green") acc.greenCount += 1;
      else if (color === "amber") acc.amberCount += 1;
      else if (color === "red") acc.redCount += 1;
      else acc.greyCount += 1;
      return acc;
    },
    { greenCount: 0, amberCount: 0, redCount: 0, greyCount: 0 },
  );
}

function sumScores(members: ChatSnapshotMember[]): number {
  return members.reduce((sum, member) => {
    if (member.latestScore == null) return sum;
    if (member.latestColor === "grey") return sum;
    return sum + member.latestScore;
  }, 0);
}

export async function getChatSnapshot(today = new Date()): Promise<ChatSnapshot> {
  const supabase = getServiceSupabase();
  const chapterName = String(process.env.NEXT_PUBLIC_CHAPTER_NAME || CHAPTER_FALLBACK_NAME);

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, name, industry, sponsor, member_since, is_committee, report_role")
    .order("name", { ascending: true });

  if (membersError) {
    throw membersError;
  }

  const memberRows = (members ?? []) as Member[];
  const memberIds = memberRows.map((member) => member.id);

  // Latest traffic light per member (privacy-safe: score, color, month only).
  const { data: trafficLights, error: trafficLightsError } = await supabase
    .from("member_traffic_lights")
    .select("member_id, report_month, score, color")
    .in("member_id", memberIds)
    .order("report_month", { ascending: false });

  if (trafficLightsError) {
    throw trafficLightsError;
  }

  const latestTrafficLightByMember = new Map<string, MemberTrafficLight>();
  // Rows arrive newest-first; keep the newest 6 per member for trend analysis.
  const historyByMember = new Map<string, MemberTrafficLight[]>();
  for (const row of (trafficLights ?? []) as MemberTrafficLight[]) {
    if (!latestTrafficLightByMember.has(row.member_id)) {
      latestTrafficLightByMember.set(row.member_id, row);
    }
    const group = historyByMember.get(row.member_id) ?? [];
    if (group.length < 6) group.push(row);
    historyByMember.set(row.member_id, group);
  }

  // Latest palms snapshot per member (lifetime snapshot preferred).
  const { data: palmsSnapshots, error: palmsError } = await supabase
    .from("member_palms_snapshots")
    .select(
      "member_id, report_from, report_to, referrals_given_inside, referrals_given_outside, referrals_received_inside, referrals_received_outside, visitors, one_to_ones, tyfcb, ceu",
    )
    .in("member_id", memberIds)
    .order("report_to", { ascending: false });

  if (palmsError) {
    throw palmsError;
  }

  const palmsByMember = new Map<string, MemberPalmsSnapshot[]>();
  for (const row of (palmsSnapshots ?? []) as MemberPalmsSnapshot[]) {
    const group = palmsByMember.get(row.member_id) ?? [];
    group.push(row);
    palmsByMember.set(row.member_id, group);
  }

  // Latest renewal cycle + open tasks per member.
  const { data: cycles, error: cyclesError } = await supabase
    .from("renewal_cycles")
    .select(
      `
      *,
      renewal_tasks (*)
    `,
    )
    .in("member_id", memberIds)
    .order("renewal_date", { ascending: false });

  if (cyclesError) {
    throw cyclesError;
  }

  const latestCycleByMember = new Map<string, { cycle: RenewalCycle; tasks: RenewalTask[] }>();
  for (const row of (cycles ?? []) as Array<
    RenewalCycle & { renewal_tasks: RenewalTask[] }
  >) {
    if (!latestCycleByMember.has(row.member_id)) {
      latestCycleByMember.set(row.member_id, {
        cycle: row,
        tasks: row.renewal_tasks ?? [],
      });
    }
  }

  // Sponsor achievements.
  let sponsorByMember = new Map<string, MemberSponsorAchievement[]>();
  try {
    const { data: sponsorRows, error: sponsorError } = await supabase
      .from("member_sponsor_achievements")
      .select("member_id, application_date, sponsored_full_name")
      .in("member_id", memberIds);

    if (sponsorError) {
      throw sponsorError;
    }

    for (const row of (sponsorRows ?? []) as MemberSponsorAchievement[]) {
      const group = sponsorByMember.get(row.member_id) ?? [];
      group.push(row);
      sponsorByMember.set(row.member_id, group);
    }
  } catch (error) {
    if (!isMissingChatSchemaError(error, "sponsor achievements")) {
      throw error;
    }
    sponsorByMember = new Map();
  }

  // Training achievements.
  let trainingByMember = new Map<string, MemberTrainingAchievement[]>();
  try {
    const { data: trainingRows, error: trainingError } = await supabase
      .from("member_training_achievements")
      .select("member_id, event_date, event_type")
      .in("member_id", memberIds);

    if (trainingError) {
      throw trainingError;
    }

    for (const row of (trainingRows ?? []) as MemberTrainingAchievement[]) {
      const group = trainingByMember.get(row.member_id) ?? [];
      group.push(row);
      trainingByMember.set(row.member_id, group);
    }
  } catch (error) {
    if (!isMissingChatSchemaError(error, "training achievements")) {
      throw error;
    }
    trainingByMember = new Map();
  }

  // Past roles.
  let pastRolesByMember = new Map<string, string[]>();
  try {
    const { data: pastRoleRows, error: pastRolesError } = await supabase
      .from("member_past_roles")
      .select("member_id, role:chapter_roles (name)")
      .in("member_id", memberIds)
      .order("display_order", { ascending: true });

    if (pastRolesError) {
      throw pastRolesError;
    }

    for (const row of (pastRoleRows ?? []) as Array<{
      member_id: string;
      role: { name: string | null }[] | null;
    }>) {
      const name = (row.role ?? [])[0]?.name ?? null;
      if (!name) continue;
      const group = pastRolesByMember.get(row.member_id) ?? [];
      if (!group.includes(name)) group.push(name);
      pastRolesByMember.set(row.member_id, group);
    }
  } catch (error) {
    if (!isMissingChatSchemaError(error, "past roles")) {
      throw error;
    }
    pastRolesByMember = new Map();
  }

  const snapshotMembers: ChatSnapshotMember[] = memberRows.map((member) => {
    const latestTrafficLight = latestTrafficLightByMember.get(member.id);
    const memberPalms = palmsByMember.get(member.id) ?? [];
    const latestPalms = selectLifetimePalmsSnapshot(memberPalms);
    // Latest exact-monthly window answers "last month" questions; lifetime covers the rest.
    const latestMonthlyPalms = memberPalms.find((row) => isExactMonthlyPalmsSnapshot(row));
    const trafficHistory: TrafficHistoryPoint[] = (historyByMember.get(member.id) ?? [])
      .slice()
      .reverse()
      .map((row) => ({
        month: row.report_month ?? null,
        score: row.score ?? null,
        color: trafficColorFromRaw(row.color),
      }));
    const latestCycle = latestCycleByMember.get(member.id);
    const openTaskCount = latestCycle
      ? latestCycle.tasks.filter((task) => task.status === "open" && isActiveRenewalTaskType(task.task_type))
          .length
      : 0;
    const stage =
      latestCycle && isWithinRenewalWorkWindow(latestCycle.cycle.renewal_date, today)
        ? calculateStage(latestCycle.cycle, today)
        : null;
    const sponsorSummary = buildSponsorAchievementSummary(
      sponsorByMember.get(member.id) ?? [],
      today,
    );
    const trainingSummary = buildTrainingAchievementSummary(
      trainingByMember.get(member.id) ?? [],
      today,
    );

    return {
      name: member.name,
      industry: member.industry,
      sponsor: member.sponsor,
      memberSince: member.member_since ?? null,
      isCommittee: member.is_committee,
      reportRole: member.report_role,
      latestScore: latestTrafficLight?.score ?? null,
      latestColor: latestTrafficLight ? trafficColorFromRaw(latestTrafficLight.color) : null,
      latestReportMonth: latestTrafficLight?.report_month ?? null,
      trafficHistory,
      monthlyReferrals:
        latestMonthlyPalms != null
          ? Number(latestMonthlyPalms.referrals_given_inside ?? 0) +
            Number(latestMonthlyPalms.referrals_given_outside ?? 0)
          : null,
      monthlyReferralsReceived:
        latestMonthlyPalms != null
          ? Number(latestMonthlyPalms.referrals_received_inside ?? 0) +
            Number(latestMonthlyPalms.referrals_received_outside ?? 0)
          : null,
      monthlyReportMonth: latestMonthlyPalms?.report_to ?? null,
      palmsReferrals:
        latestPalms != null
          ? Number(latestPalms.referrals_given_inside ?? 0) +
            Number(latestPalms.referrals_given_outside ?? 0)
          : null,
      palmsReferralsReceived:
        latestPalms != null
          ? Number(latestPalms.referrals_received_inside ?? 0) +
            Number(latestPalms.referrals_received_outside ?? 0)
          : null,
      palmsOneToOne: latestPalms?.one_to_ones ?? null,
      palmsTyfcb: latestPalms?.tyfcb ?? null,
      palmsCeu: latestPalms?.ceu ?? null,
      palmsVisitors: latestPalms?.visitors ?? null,
      renewalStatus: latestCycle?.cycle.status ?? null,
      renewalDate: latestCycle?.cycle.renewal_date ?? null,
      renewalStage: stage ?? null,
      isTwoYear: latestCycle?.cycle.is_two_year_renewal ?? false,
      openTaskCount,
      lifetimeSponsors: sponsorSummary.lifetimeCount,
      pastYearSponsors: sponsorSummary.pastYearCount,
      lifetimeTrainings: trainingSummary.lifetimeCount,
      pastYearTrainings: trainingSummary.pastYearCount,
      pastRoles: pastRolesByMember.get(member.id) ?? [],
    };
  });

  const counts = colorCounts(snapshotMembers);
  const scoredMembers = snapshotMembers.filter(
    (member) => member.latestScore != null && member.latestColor !== "grey",
  );
  const totalTyfcb = snapshotMembers.reduce(
    (sum, member) => sum + Number(member.palmsTyfcb ?? 0),
    0,
  );

  const summary: ChatSummary = {
    memberCount: snapshotMembers.length,
    committeeCount: snapshotMembers.filter((member) => member.isCommittee).length,
    activeCycles: snapshotMembers.filter(
      (member) =>
        member.renewalStage !== null &&
        member.renewalStage !== "Renewed" &&
        member.renewalStage !== "Dropped",
    ).length,
    renewedCount: snapshotMembers.filter((member) => member.renewalStatus === "renewed").length,
    droppedCount: snapshotMembers.filter((member) => member.renewalStatus === "dropped").length,
    averageScore:
      scoredMembers.length > 0
        ? Number((sumScores(snapshotMembers) / scoredMembers.length).toFixed(1))
        : null,
    greenCount: counts.greenCount,
    amberCount: counts.amberCount,
    redCount: counts.redCount,
    greyCount: counts.greyCount,
    totalTyfcb,
  };

  return {
    chapterName,
    summary,
    members: snapshotMembers,
  };
}

/** Compact human-readable JSON for the LLM prompt (names, metrics & statuses only; no contact info). */
export function snapshotToPromptDataset(snapshot: ChatSnapshot): Record<string, unknown> {
  const chapter = snapshot.chapterName;
  return {
    chapterDetails: {
      name: chapter,
      summary: {
        members: snapshot.summary.memberCount,
        committee: snapshot.summary.committeeCount,
        activeRenewals: snapshot.summary.activeCycles,
        renewed: snapshot.summary.renewedCount,
        dropped: snapshot.summary.droppedCount,
        averageScore: snapshot.summary.averageScore,
        zones: {
          green: snapshot.summary.greenCount,
          amber: snapshot.summary.amberCount,
          red: snapshot.summary.redCount,
          grey: snapshot.summary.greyCount,
        },
        totalTyfcb: snapshot.summary.totalTyfcb,
      },
    },
    members: snapshot.members.map((member, idx) => ({
      num: idx + 1,
      name: member.name,
      industry: member.industry || "N/A",
      sponsor: member.sponsor || "N/A",
      committee: member.isCommittee,
      score: member.latestScore ?? "N/A",
      zone: member.latestColor ?? "grey",
      reportMonth: member.latestReportMonth ?? "N/A",
      trend: member.trafficHistory.map((p) => ({
        m: p.month ?? "N/A",
        s: p.score ?? "N/A",
        c: p.color,
      })),
      lastMonthReferrals: member.monthlyReferrals ?? "N/A",
      lastMonthReceived: member.monthlyReferralsReceived ?? "N/A",
      lastMonthReport: member.monthlyReportMonth ?? "N/A",
      palmsReferrals: member.palmsReferrals ?? "N/A",
      palmsReferralsReceived: member.palmsReferralsReceived ?? "N/A",
      palms1to1: member.palmsOneToOne ?? "N/A",
      palmsCEU: member.palmsCeu ?? "N/A",
      palmsTYFCB: member.palmsTyfcb ?? "N/A",
      palmsVisitors: member.palmsVisitors ?? "N/A",
      renewalStatus: member.renewalStatus ?? "N/A",
      renewalDate: member.renewalDate ?? "N/A",
      renewalStage: member.renewalStage ?? "N/A",
      isTwoYear: member.isTwoYear,
      memberSince: member.memberSince ?? "N/A",
      openTasks: member.openTaskCount,
      sponsorsLifetime: member.lifetimeSponsors,
      sponsorsPastYear: member.pastYearSponsors,
      trainingsLifetime: member.lifetimeTrainings,
      trainingsPastYear: member.pastYearTrainings,
      pastRoles: member.pastRoles.length > 0 ? member.pastRoles : [],
    })),
  };
}