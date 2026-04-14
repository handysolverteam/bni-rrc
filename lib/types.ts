export type RenewalStatus = "active" | "renewed" | "dropped";

export type RenewalStage =
  | "Upcoming"
  | "MC Discussion Due"
  | "Member Discussion"
  | "Monthly Review"
  | "Renewal Due"
  | "Docs Pending"
  | "Critical Deadline"
  | "Renewed"
  | "Dropped";

export type RenewalTaskType =
  | "mc_discussion"
  | "member_discussion"
  | "monthly_review"
  | "renewal_push"
  | "docs_collection"
  | "critical_deadline";

export type Member = {
  id: string;
  auth_user_id: string | null;
  name: string;
  industry: string | null;
  sponsor: string | null;
  report_role: string | null;
  is_committee: boolean;
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
  monthly_review_date: string;
  renewal_push_date: string;
  docs_deadline: string;
  final_deadline: string;
};

export type DashboardCycle = RenewalCycle & {
  member: Member;
  stage: RenewalStage;
  derived_dates: DerivedRenewalDates;
  assignments: RenewalAssignment[];
  renewal_tasks: RenewalTask[];
  open_task_count: number;
};

export type ImportMemberRow = {
  name: string;
  industry: string;
  reportRole: string;
  membershipStatus: string;
  dueDate: string;
  autoRenewalEnabled: boolean;
};
