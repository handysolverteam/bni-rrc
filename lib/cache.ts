import { revalidateTag, unstable_cache } from "next/cache";
import {
  getAchievementMembers as fetchAchievementMembers,
  getDashboardCycles as fetchDashboardCycles,
  getMemberDetail as fetchMemberDetail,
} from "@/lib/renewals/data";
import { getPalmsMonthlyCoverage as fetchPalmsMonthlyCoverage } from "@/lib/renewals/import-coverage";
import { getTaskInboxItems as fetchTaskInboxItems } from "@/lib/renewals/task-inbox";

/**
 * Cache tags used by unstable_cache wrappers below. Mutating API routes call
 * invalidateCache([...]) after writes so any cached view refreshes immediately.
 */
export const CACHE_TAGS = {
  renewals: "renewals",
  members: "members",
  imports: "imports",
} as const;

export async function invalidateCache(tags: string[]): Promise<void> {
  await Promise.all(tags.map((tag) => revalidateTag(tag, { expire: 0 })));
}

// Dashboard + Tasks buckets share this data, so a single 60s cache serves all three.
export const getDashboardCycles = unstable_cache(
  fetchDashboardCycles,
  ["dashboard-cycles"],
  { revalidate: 60, tags: [CACHE_TAGS.renewals] },
);

export const getAchievementMembers = unstable_cache(
  fetchAchievementMembers,
  ["achievement-members"],
  { revalidate: 60, tags: [CACHE_TAGS.renewals, CACHE_TAGS.members] },
);

// Member detail backs the member page, achievements page, and both performance pages.
export const getMemberDetail = unstable_cache(
  (memberId: string) => fetchMemberDetail(memberId),
  ["member-detail"],
  { revalidate: 60, tags: [CACHE_TAGS.renewals, CACHE_TAGS.members] },
);

export const getTaskInboxItems = unstable_cache(
  fetchTaskInboxItems,
  ["task-inbox"],
  { revalidate: 60, tags: [CACHE_TAGS.renewals] },
);

export const getPalmsMonthlyCoverage = unstable_cache(
  fetchPalmsMonthlyCoverage,
  ["palms-coverage"],
  { revalidate: 120, tags: [CACHE_TAGS.imports] },
);