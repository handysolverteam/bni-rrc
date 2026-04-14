import { getDashboardCycles } from "@/lib/renewals/data";

export async function GET() {
  try {
    const members = await getDashboardCycles();
    return Response.json({ members });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to fetch members" },
      { status: 500 },
    );
  }
}
