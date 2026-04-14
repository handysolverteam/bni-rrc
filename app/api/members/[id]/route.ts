import { getMemberDetail } from "@/lib/renewals/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const member = await getMemberDetail(id);
    return Response.json(member);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to fetch member" },
      { status: 500 },
    );
  }
}
