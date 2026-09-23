import { getServiceSupabase } from "../supabase/server";
import type {
  AchievementMemberListItem,
  ChapterRole,
  DashboardCycle,
  Member,
  MemberAlias,
  MemberPastRoleEntry,
  MemberPalmsSnapshot,
  MemberSponsorAchievement,
  MemberTrainingAchievement,
  MemberTrafficLight,
  RenewalAssignment,
  RenewalCycle,
  RenewalTask,
} from "../types";
import { selectLifetimePalmsSnapshot } from "./achievements";
import { buildSponsorAchievementSummary } from "./sponsor-achievements";
import {
  addDays,
  calculateStage,
  getDerivedRenewalDates,
  isWithinRenewalWorkWindow,
  toDateOnly,
} from "./stage";
import { buildTrainingAchievementSummary } from "./training-achievements";
import { isExactMonthlyPalmsSnapshot } from "./palms-monthly-performance";
import { isActiveRenewalTaskType } from "./task-types";
import { getMemberAliases } from "./member-aliases";
import {
  PAST_YEAR_TRAFFIC_LIGHT_LIMIT,
  groupTrafficLightHistoryByMember,
} from "./traffic-light-history";

function isMissingSponsorAchievementsSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  const details = typeof maybeError.details === "string" ? maybeError.details.toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    code === "42P01" ||
    combined.includes("member_sponsor_achievements") ||
    combined.includes("sponsor achievements")
  );
}

function isMissingTrainingAchievementsSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  const details = typeof maybeError.details === "string" ? maybeError.details.toLowerCase() : "";
  const combined = `${message} ${details}`;

  return (
    code === "42P01" ||
    combined.includes("member_training_achievements") ||
    combined.includes("training achievements")
  );
}

function isMissingMemberAliasesSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  const details = typeof maybeError.details === "string" ? maybeError.details.toLowerCase() : "";
  const combined = `${message} ${details}`;

  return code === "42P01" || combined.includes("member_aliases") || combined.includes("member aliases");
}

async function getMemberAliasesSafely(memberId: string): Promise<MemberAlias[]> {
  try {
    return await getMemberAliases(memberId);
  } catch (error) {
    if (isMissingMemberAliasesSchemaError(error)) {
      return [];
    }

    throw error;
  }
}

type RenewalCycleRow = RenewalCycle & {
  members: Member | null;
  renewal_assignments: Array<
    RenewalAssignment & {
      members: Pick<Member, "id" | "name" | "industry"> | null;
    }
  >;
  renewal_tasks: RenewalTask[];
};

// Shared column list for cycle embeds. Milestone/audit timestamps are omitted because
// the UI never reads them on list/detail pages, shrinking payloads on every route.
const CYCLE_EMBED_SELECT = `
  id, member_id, renewal_year, renewal_date, reported_due_date, status,
  source_membership_status, auto_renewal_enabled, is_two_year_renewal,
  last_followup_date, next_followup_date, online_form_filled, online_form_filled_date,
  checklist_filled, checklist_filled_date, payment_link_generated, payment_link_generated_date,
  payment_made, payment_made_date,
  members (id, name, industry, sponsor, report_role, member_since, is_committee, auth_user_id),
  renewal_assignments (
    id, renewal_cycle_id, assignee_member_id, slot,
    members:assignee_member_id (id, name, industry)
  ),
  renewal_tasks (id, task_type, status, due_date, notes, completed_at)
`;

export function enrichCycle(
  row: RenewalCycleRow,
  today = new Date(),
  trafficLightHistory: MemberTrafficLight[] = [],
): DashboardCycle {
  return {
    ...row,
    member: row.members!,
    latest_traffic_light: trafficLightHistory[0] ?? null,
    traffic_light_history: trafficLightHistory,
    stage: calculateStage(
      {
        renewal_date: row.renewal_date,
        status: row.status,
        renewal_tasks: row.renewal_tasks,
      },
      today,
    ),
    derived_dates: getDerivedRenewalDates(row.renewal_date),
    assignments: row.renewal_assignments.map((assignment) => ({
      ...assignment,
      assignee: assignment.members ?? undefined,
    })),
    open_task_count: row.renewal_tasks.filter(
      (task) => task.status === "open" && isActiveRenewalTaskType(task.task_type),
    ).length,
  };
}

async function getTrafficLightHistoriesByMember(
  memberIds: string[],
  limit?: number | null,
): Promise<Map<string, MemberTrafficLight[]>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_traffic_lights")
    .select("*")
    .in("member_id", memberIds)
    .order("report_month", { ascending: false });

  if (error) {
    throw error;
  }

  return groupTrafficLightHistoryByMember((data ?? []) as MemberTrafficLight[], limit);
}

async function getLatestPalmsSnapshotsByMember(
  memberIds: string[],
): Promise<Map<string, MemberPalmsSnapshot>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_palms_snapshots")
    .select("*")
    .in("member_id", memberIds)
    .order("report_to", { ascending: false });

  if (error) {
    throw error;
  }

  const snapshotsByMember = new Map<string, MemberPalmsSnapshot[]>();

  for (const row of (data ?? []) as MemberPalmsSnapshot[]) {
    const snapshots = snapshotsByMember.get(row.member_id) ?? [];
    snapshots.push(row);
    snapshotsByMember.set(row.member_id, snapshots);
  }

  const snapshots = new Map<string, MemberPalmsSnapshot>();

  for (const [memberId, memberSnapshots] of snapshotsByMember) {
    const selectedSnapshot = selectLifetimePalmsSnapshot(memberSnapshots);

    if (selectedSnapshot) {
      snapshots.set(memberId, selectedSnapshot);
    }
  }

  return snapshots;
}

async function getPalmsSnapshotsByMember(
  memberIds: string[],
): Promise<Map<string, MemberPalmsSnapshot[]>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_palms_snapshots")
    .select("*")
    .in("member_id", memberIds)
    .order("report_to", { ascending: false });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, MemberPalmsSnapshot[]>();

  for (const row of (data ?? []) as MemberPalmsSnapshot[]) {
    const snapshots = grouped.get(row.member_id) ?? [];
    snapshots.push(row);
    grouped.set(row.member_id, snapshots);
  }

  return grouped;
}

async function getAvailableRoles(): Promise<ChapterRole[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("chapter_roles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ChapterRole[];
}

async function getPastRolesByMember(
  memberIds: string[],
): Promise<Map<string, MemberPastRoleEntry[]>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_past_roles")
    .select("*, role:chapter_roles (*)")
    .in("member_id", memberIds)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, MemberPastRoleEntry[]>();

  for (const row of (data ?? []) as MemberPastRoleEntry[]) {
    const entries = grouped.get(row.member_id) ?? [];
    entries.push(row);
    grouped.set(row.member_id, entries);
  }

  return grouped;
}

async function getSponsorAchievementsByMember(
  memberIds: string[],
): Promise<Map<string, MemberSponsorAchievement[]>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("member_sponsor_achievements")
      .select("*")
      .in("member_id", memberIds)
      .order("application_date", { ascending: false })
      .order("sponsored_full_name", { ascending: true });

    if (error) {
      if (isMissingSponsorAchievementsSchemaError(error)) {
        return new Map();
      }

      throw error;
    }

    const grouped = new Map<string, MemberSponsorAchievement[]>();

    for (const row of (data ?? []) as MemberSponsorAchievement[]) {
      const achievements = grouped.get(row.member_id) ?? [];
      achievements.push(row);
      grouped.set(row.member_id, achievements);
    }

    return grouped;
  } catch (error) {
    if (isMissingSponsorAchievementsSchemaError(error)) {
      return new Map();
    }

    throw error;
  }
}

async function getTrainingAchievementsByMember(
  memberIds: string[],
): Promise<Map<string, MemberTrainingAchievement[]>> {
  if (memberIds.length === 0) {
    return new Map();
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("member_training_achievements")
      .select("*")
      .in("member_id", memberIds)
      .order("event_date", { ascending: false })
      .order("event_type", { ascending: true });

    if (error) {
      if (isMissingTrainingAchievementsSchemaError(error)) {
        return new Map();
      }

      throw error;
    }

    const grouped = new Map<string, MemberTrainingAchievement[]>();

    for (const row of (data ?? []) as MemberTrainingAchievement[]) {
      const achievements = grouped.get(row.member_id) ?? [];
      achievements.push(row);
      grouped.set(row.member_id, achievements);
    }

    return grouped;
  } catch (error) {
    if (isMissingTrainingAchievementsSchemaError(error)) {
      return new Map();
    }

    throw error;
  }
}

async function getLatestTrainingReportAnchor(importBatchIds: string[]): Promise<string | null> {
  if (importBatchIds.length === 0) {
    return null;
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("import_batches")
      .select("source_report_to")
      .in("id", importBatchIds)
      .not("source_report_to", "is", null)
      .order("source_report_to", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    return (data?.[0]?.source_report_to as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function getDashboardCycles(today = new Date()): Promise<DashboardCycle[]> {
  const supabase = getServiceSupabase();
  const workWindowEnd = toDateOnly(addDays(today, 120));

  const { data, error } = await supabase
    .from("renewal_cycles")
    .select(CYCLE_EMBED_SELECT)
    .lte("renewal_date", workWindowEnd)
    .order("renewal_date", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as unknown as RenewalCycleRow[]).filter(
    (row) => row.members && isWithinRenewalWorkWindow(row.renewal_date, today),
  );
  const trafficLightHistories = await getTrafficLightHistoriesByMember(
    rows.map((row) => row.member_id),
  );

  return rows.map((row) =>
    enrichCycle(row, today, trafficLightHistories.get(row.member_id) ?? []),
  );
}

export async function getAchievementMembers(
  today = new Date(),
): Promise<AchievementMemberListItem[]> {
  const supabase = getServiceSupabase();
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });

  if (membersError) {
    throw membersError;
  }

  const memberRows = (members ?? []) as Member[];
  const memberIds = memberRows.map((member) => member.id);

  const [cyclesResult, trafficLightHistories, latestPalmsSnapshots] = await Promise.all([
    supabase
      .from("renewal_cycles")
      .select(CYCLE_EMBED_SELECT)
      .in("member_id", memberIds)
      .order("renewal_date", { ascending: false }),
    getTrafficLightHistoriesByMember(memberIds),
    getLatestPalmsSnapshotsByMember(memberIds),
  ]);

  if (cyclesResult.error) {
    throw cyclesResult.error;
  }

  const latestCyclesByMember = new Map<string, DashboardCycle>();

  for (const row of (cyclesResult.data ?? []) as unknown as RenewalCycleRow[]) {
    if (latestCyclesByMember.has(row.member_id)) {
      continue;
    }

    const member = memberRows.find((currentMember) => currentMember.id === row.member_id);

    if (!member) {
      continue;
    }

    latestCyclesByMember.set(
      row.member_id,
      enrichCycle({ ...row, members: member }, today, trafficLightHistories.get(row.member_id) ?? []),
    );
  }

  return memberRows.map((member) => ({
    member,
    currentCycle: latestCyclesByMember.get(member.id) ?? null,
    latestPalmsSnapshot: latestPalmsSnapshots.get(member.id) ?? null,
  }));
}

export async function getMemberDetail(memberId: string, today = new Date()) {
  const supabase = getServiceSupabase();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (memberError) {
    throw memberError;
  }

  const [cyclesResult, trafficLightHistories, palmsByMember, memberAliases, availableRoles, pastRolesByMember, sponsorAchievementsByMember, trainingAchievementsByMember] =
    await Promise.all([
      supabase
        .from("renewal_cycles")
        .select(CYCLE_EMBED_SELECT)
        .eq("member_id", memberId)
        .order("renewal_date", { ascending: false }),
      getTrafficLightHistoriesByMember([memberId], PAST_YEAR_TRAFFIC_LIGHT_LIMIT),
      getPalmsSnapshotsByMember([memberId]),
      getMemberAliasesSafely(memberId),
      getAvailableRoles(),
      getPastRolesByMember([memberId]),
      getSponsorAchievementsByMember([memberId]),
      getTrainingAchievementsByMember([memberId]),
    ]);

  if (cyclesResult.error) {
    throw cyclesResult.error;
  }

  const trafficLightHistory = trafficLightHistories.get(memberId) ?? [];
  const memberPalmsSnapshots = palmsByMember.get(memberId) ?? [];
  const latestPalmsSnapshot = selectLifetimePalmsSnapshot(memberPalmsSnapshots) ?? null;
  const sponsorAchievements = sponsorAchievementsByMember.get(memberId) ?? [];
  const sponsorSummary = buildSponsorAchievementSummary(sponsorAchievements, today);
  const trainingAchievements = trainingAchievementsByMember.get(memberId) ?? [];
  const trainingSummary = buildTrainingAchievementSummary(trainingAchievements, today);
  const enrichedCycles = ((cyclesResult.data ?? []) as unknown as RenewalCycleRow[]).map((row) =>
    enrichCycle({ ...row, members: member as Member }, today, trafficLightHistory),
  );
  const latestExactMonthlyPalmsReportTo = memberPalmsSnapshots
    .filter(isExactMonthlyPalmsSnapshot)
    .map((snapshot) => snapshot.report_to)
    .sort((left, right) => right.localeCompare(left))[0];
  const latestTrainingReportAnchor = await getLatestTrainingReportAnchor(
    [...new Set(trainingAchievements.map((item) => item.import_batch_id).filter((id): id is string => Boolean(id)))],
  );
  const performanceAnchorDate =
    latestExactMonthlyPalmsReportTo ??
    latestTrainingReportAnchor ??
    today.toISOString().slice(0, 10);

  return {
    member: member as Member,
    currentCycle: enrichedCycles[0] ?? null,
    cycles: enrichedCycles,
    latestPalmsSnapshot,
    palmsSnapshots: memberPalmsSnapshots,
    sponsorAchievements,
    sponsorSummary,
    trainingAchievements,
    trainingSummary,
    performanceAnchorDate,
    availableRoles,
    pastRoles: pastRolesByMember.get(memberId) ?? [],
    aliases: memberAliases,
  };
}

export async function getCommitteeMembers(): Promise<Member[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("is_committee", true)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Member[];
}
