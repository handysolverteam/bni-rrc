import MemberAchievements from "@/components/MemberAchievements";
import { getMemberDetail } from "@/lib/renewals/data";

export const dynamic = "force-dynamic";

export default async function MemberAchievementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail: Awaited<ReturnType<typeof getMemberDetail>> | null = null;
  let error: string | null = null;

  try {
    detail = await getMemberDetail(id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load member achievements";
  }

  return error || !detail ? (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <h1 className="font-semibold">Achievements unavailable</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
    </div>
  ) : (
    <MemberAchievements detail={detail} />
  );
}
