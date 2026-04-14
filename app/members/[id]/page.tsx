import Link from "next/link";
import MemberDetail from "@/components/MemberDetail";
import { getCommitteeMembers, getMemberDetail } from "@/lib/renewals/data";
import type { Member } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let detail: Awaited<ReturnType<typeof getMemberDetail>> | null = null;
  let committeeMembers: Member[] = [];
  let error: string | null = null;

  try {
    const [memberDetail, committee] = await Promise.all([
      getMemberDetail(id),
      getCommitteeMembers(),
    ]);
    detail = memberDetail;
    committeeMembers = committee;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load member";
  }

  return (
    <div className="space-y-6">
      <Link className="text-sm text-[var(--accent)] hover:underline" href="/">
        Back to dashboard
      </Link>
      {error || !detail ? (
        <div className="rounded-md border border-[var(--line)] bg-white p-4">
          <h1 className="font-semibold">Member unavailable</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
        </div>
      ) : (
        <MemberDetail detail={detail} committeeMembers={committeeMembers} />
      )}
    </div>
  );
}
