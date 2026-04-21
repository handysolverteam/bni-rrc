export type RenewalStatus = "active" | "renewed" | "dropped";
export type TrafficLightColor = "green" | "yellow" | "red" | "grey";

export type RenewalStage =
  | "MC Discussion"
  | "Member Discussion"
  | "Documents Pending"
  | "Payment Pending"
  | "Critical Deadline"
  | "Renewed"
  | "Dropped";

export type RenewalTaskType =
  | "mc_discussion"
  | "member_discussion"
  | "monthly_review"
  | "renewal_push"
  | "docs_collection"
  | "payment_due"
  | "critical_deadline";

export type Member = {
  id: string;
  auth_user_id: string | null;
  name: string;
  industry: string | null;
  sponsor: string | null;
  report_role: string | null;
  member_since: string | null;
  is_committee: boolean;
};

export type MemberTrafficLight = {
  id: string;
  member_id: string;
  report_month: string;
  score: number;
  color: TrafficLightColor;
  present_count: number;
  absent_count: number;
  late_count: number;
  medical_count: number;
  substitute_count: number;
  referrals_given: number;
  referrals_received: number;
  visitors: number;
  testimonials: number;
  tyfcb: number | null;
  trainings: number;
  week_count: number;
  import_batch_id: string | null;
};

export type MemberPalmsSnapshot = {
  id: string;
  member_id: string;
  chapter_name: string;
  report_from: string;
  report_to: string;
  run_at: string | null;
  present_count: number;
  absent_count: number;
  late_count: number;
  medical_count: number;
  substitute_count: number;
  referrals_given_inside: number;
  referrals_given_outside: number;
  referrals_received_inside: number;
  referrals_received_outside: number;
  visitors: number;
  one_to_ones: number;
  tyfcb: number | null;
  ceu: number;
  trainings: number;
  import_batch_id: string | null;
};

export type RenewalCycle = {
  id: string;
  member_id: string;
  renewal_year: number;
  renewal_date: string;
  status: RenewalStatus;
  source_membership_status: string | null;
  auto_renewal_enabled: boolean;
  last_followup_date: string | null;
  next_followup_date: string | null;
  online_form_filled: boolean;
  online_form_filled_date: string | null;
  checklist_filled: boolean;
  checklist_filled_date: string | null;
  payment_link_generated: boolean;
  payment_link_generated_date: string | null;
  payment_made: boolean;
  payment_made_date: string | null;
};

export type RenewalTask = {
  id: string;
  renewal_cycle_id: string;
  task_type: RenewalTaskType;
  due_date: string;
  status: "open" | "completed" | "cancelled";
  notes: string | null;
  completed_at: string | null;
};

export type RenewalAssignment = {
  id: string;
  renewal_cycle_id: string;
  assignee_member_id: string;
  slot: 1 | 2;
  assignee?: Pick<Member, "id" | "name" | "industry">;
};

export type DerivedRenewalDates = {
  mc_discussion_date: string;
  member_discussion_date: string;
  documents_sent_date: string;
  payment_due_date: string;
  final_deadline: string;
};

export type DashboardCycle = RenewalCycle & {
  member: Member;
  latest_traffic_light: MemberTrafficLight | null;
  traffic_light_history: MemberTrafficLight[];
  stage: RenewalStage | null;
  derived_dates: DerivedRenewalDates;
  assignments: RenewalAssignment[];
  renewal_tasks: RenewalTask[];
  open_task_count: number;
};

export type AchievementMemberListItem = {
  member: Member;
  currentCycle: DashboardCycle | null;
  latestPalmsSnapshot: MemberPalmsSnapshot | null;
};

export type ImportMemberRow = {
  name: string;
  industry: string;
  reportRole: string;
  membershipStatus: string;
  dueDate: string;
  autoRenewalEnabled: boolean;
};
