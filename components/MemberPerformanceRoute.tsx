import { getMemberDetail } from "@/lib/cache";
import MemberPerformance from "./MemberPerformance";

export default async function MemberPerformanceRoute({
  memberId,
  periodMonths,
}: {
  memberId: string;
  periodMonths: 6 | 12;
}) {
  let detail: Awaited<ReturnType<typeof getMemberDetail>> | null = null;
  let error: string | null = null;
  const periodLabel = periodMonths === 12 ? "Past year" : `Past ${periodMonths} months`;

  try {
    detail = await getMemberDetail(memberId);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load member performance";
  }

  return error || !detail ? (
    <div className="rounded-md border border-[var(--line)] bg-white p-4">
      <h1 className="font-semibold">{periodLabel} performance unavailable</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
    </div>
  ) : (
    <MemberPerformance detail={detail} periodMonths={periodMonths} />
  );
}
