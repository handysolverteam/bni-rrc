import AchievementsDirectory from "@/components/AchievementsDirectory";
import { getAchievementMembers } from "@/lib/cache";
import type { AchievementMemberListItem } from "@/lib/types";

export const revalidate = 60;

export default async function AchievementsPage() {
  let members: AchievementMemberListItem[] = [];
  let error: string | null = null;

  try {
    members = await getAchievementMembers();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load achievements";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[var(--accent)]">Recognition</p>
        <h1 className="text-3xl font-semibold tracking-normal">Achievements</h1>
        <p className="max-w-3xl text-sm text-[var(--muted)]">
          Open any member profile to see PALMS lifetime achievements, renewal details, and traffic-light performance in one place.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Achievements unavailable</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        </div>
      ) : (
        <AchievementsDirectory members={members} />
      )}
    </div>
  );
}
