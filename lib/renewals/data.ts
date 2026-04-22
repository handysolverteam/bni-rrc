import { getServiceSupabase } from "../supabase/server";
import type {
  AchievementMemberListItem,
  ChapterRole,
  DashboardCycle,
  Member,
  MemberPastRoleEntry,
  MemberPalmsSnapshot,
  MemberSponsorAchievement,
  MemberTrafficLight,
  RenewalAssignment,
  RenewalCycle,
  RenewalTask,
} from "../types";
import { buildSponsorAchievementSummary } from "./sponsor-achievements";
import { calculateStage, getDerivedRenewalDates, isWithinRenewalWorkWindow } from "./stage";
import { isActiveRenewalTaskType } from "./task-types";
import {
  PAST_YEAR_TRAFFIC_LIGHT_LIMIT,
  groupTrafficLightHistoryByMember,
} from "./traffic-light-history";

type RenewalCycleRow = RenewalCycle & {
  members: Member | null;
  renewal_assignments: Array<
    RenewalAssignment & {
      members: Pick<Member, "id" | "name" | "industry"> | null;
    }
  >;
  renewal_tasks: RenewalTask[];
};

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

  const snapshots = new Map<string, MemberPalmsSnapshot>();

  for (const row of (data ?? []) as MemberPalmsSnapshot[]) {
    if (!snapshots.has(row.member_id)) {
      snapshots.set(row.member_id, row);
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

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("member_sponsor_achievements")
    .select("*")
    .in("member_id", memberIds)
    .order("application_date", { ascending: false })
    .order("sponsored_full_name", { ascending: true });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, MemberSponsorAchievement[]>();

  for (const row of (data ?? []) as MemberSponsorAchievement[]) {
    const achievements = grouped.get(row.member_id) ?? [];
    achievements.push(row);
    grouped.set(row.member_id, achievements);
  }

  return grouped;
}

export async function getDashboardCycles(today = new Date()): Promise<DashboardCycle[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("renewal_cycles")
    .select(
      `
      *,
      members (*),
      renewal_assignments (
        *,
        members:assignee_member_id (id, name, industry)
      ),
      renewal_tasks (*)
    `,
    )
    .order("renewal_date", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as RenewalCycleRow[]).filter(
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

  const { data: cycles, error: cyclesError } = await supabase
    .from("renewal_cycles")
    .select(
      `
      *,
      members (*),
      renewal_assignments (
        *,
        members:assignee_member_id (id, name, industry)
      ),
      renewal_tasks (*)
    `,
    )
    .in("member_id", memberIds)
    .order("renewal_date", { ascending: false });

  if (cyclesError) {
    throw cyclesError;
  }

  const trafficLightHistories = await getTrafficLightHistoriesByMember(memberIds);
  const latestPalmsSnapshots = await getLatestPalmsSnapshotsByMember(memberIds);
  const latestCyclesByMember = new Map<string, DashboardCycle>();

  for (const row of (cycles ?? []) as RenewalCycleRow[]) {
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

  const { data: cycles, error: cyclesError } = await supabase
    .from("renewal_cycles")
    .select(
      `
      *,
      members (*),
      renewal_assignments (
        *,
        members:assignee_member_id (id, name, industry)
      ),
      renewal_tasks (*)
    `,
    )
    .eq("member_id", memberId)
    .order("renewal_date", { ascending: false });

  if (cyclesError) {
    throw cyclesError;
  }

  const trafficLightHistories = await getTrafficLightHistoriesByMember(
    [memberId],
    PAST_YEAR_TRAFFIC_LIGHT_LIMIT,
  );
  const trafficLightHistory = trafficLightHistories.get(memberId) ?? [];
  const latestPalmsSnapshots = await getLatestPalmsSnapshotsByMember([memberId]);
  const palmsSnapshotsByMember = await getPalmsSnapshotsByMember([memberId]);
  const [availableRoles, pastRolesByMember, sponsorAchievementsByMember] = await Promise.all([
    getAvailableRoles(),
    getPastRolesByMember([memberId]),
    getSponsorAchievementsByMember([memberId]),
  ]);
  const enrichedCycles = ((cycles ?? []) as RenewalCycleRow[]).map((row) =>
    enrichCycle({ ...row, members: member as Member }, today, trafficLightHistory),
  );
  const sponsorSummary = buildSponsorAchievementSummary(
    sponsorAchievementsByMember.get(memberId) ?? [],
    today,
  );

  return {
    member: member as Member,
    currentCycle: enrichedCycles[0] ?? null,
    cycles: enrichedCycles,
    latestPalmsSnapshot: latestPalmsSnapshots.get(memberId) ?? null,
    palmsSnapshots: palmsSnapshotsByMember.get(memberId) ?? [],
    sponsorAchievements: sponsorAchievementsByMember.get(memberId) ?? [],
    sponsorSummary,
    availableRoles,
    pastRoles: pastRolesByMember.get(memberId) ?? [],
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
