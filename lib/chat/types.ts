export interface ChatOption {
  id: string;
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  options?: ChatOption[];
  timestamp: string;
  createdAt?: string;
}

export interface TrafficHistoryPoint {
  month: string | null;
  score: number | null;
  color: string;
}

export interface ChatSnapshotMember {
  name: string;
  industry: string | null;
  sponsor: string | null;
  memberSince: string | null;
  isCommittee: boolean;
  reportRole: string | null;
  latestScore: number | null;
  latestColor: string | null;
  latestReportMonth: string | null;
  /** Oldest-to-newest, at most the last 6 scored reports. */
  trafficHistory: TrafficHistoryPoint[];
  /** Latest exact-monthly PALMS window (for "last month" questions); null when absent. */
  monthlyReferrals: number | null;
  monthlyReferralsReceived: number | null;
  monthlyReportMonth: string | null;
  palmsReferrals: number | null;
  palmsReferralsReceived: number | null;
  palmsOneToOne: number | null;
  palmsTyfcb: number | null;
  palmsCeu: number | null;
  palmsVisitors: number | null;
  renewalStatus: string | null;
  renewalDate: string | null;
  renewalStage: string | null;
  isTwoYear: boolean;
  openTaskCount: number;
  lifetimeSponsors: number;
  pastYearSponsors: number;
  lifetimeTrainings: number;
  pastYearTrainings: number;
  pastRoles: string[];
}

export interface ChatSummary {
  memberCount: number;
  committeeCount: number;
  activeCycles: number;
  renewedCount: number;
  droppedCount: number;
  averageScore: number | null;
  greenCount: number;
  amberCount: number;
  redCount: number;
  greyCount: number;
  totalTyfcb: number;
}

export interface ChatSnapshot {
  chapterName: string;
  summary: ChatSummary;
  members: ChatSnapshotMember[];
}