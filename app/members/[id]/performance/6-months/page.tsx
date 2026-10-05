import MemberPerformanceRoute from "@/components/MemberPerformanceRoute";

export const revalidate = 60;

export default async function MemberSixMonthPerformancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MemberPerformanceRoute memberId={id} periodMonths={6} />;
}
