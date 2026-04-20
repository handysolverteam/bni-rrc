import { getServiceSupabase } from "../supabase/server";
import type {
  DashboardCycle,
  Member,
  MemberTrafficLight,
  RenewalAssignment,
  RenewalCycle,
  RenewalTask,
} from "../types";
import { calculateStage, getDerivedRenewalDates, isWithinRenewalWorkWindow } from "./stage";
import { isActiveRenewalTaskType } from "./task-types";

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
  latestTrafficLight: MemberTrafficLight | null = null,
): DashboardCycle {
  return {
    ...row,
    member: row.members!,
    latest_traffic_light: latestTrafficLight,
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

async function getLatestTrafficLightsByMember(
  memberIds: string[],
): Promise<Map<string, MemberTrafficLight>> {
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

  const latestByMember = new Map<string, MemberTrafficLight>();

  for (const trafficLight of (data ?? []) as MemberTrafficLight[]) {
    if (!latestByMember.has(trafficLight.member_id)) {
      latestByMember.set(trafficLight.member_id, trafficLight);
    }
  }

  return latestByMember;
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
  const latestTrafficLights = await getLatestTrafficLightsByMember(
    rows.map((row) => row.member_id),
  );

  return rows.map((row) =>
    enrichCycle(row, today, latestTrafficLights.get(row.member_id) ?? null),
  );
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

  const latestTrafficLights = await getLatestTrafficLightsByMember([memberId]);
  const latestTrafficLight = latestTrafficLights.get(memberId) ?? null;
  const enrichedCycles = ((cycles ?? []) as RenewalCycleRow[]).map((row) =>
    enrichCycle({ ...row, members: member as Member }, today, latestTrafficLight),
  );

  return {
    member: member as Member,
    currentCycle: enrichedCycles[0] ?? null,
    cycles: enrichedCycles,
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
