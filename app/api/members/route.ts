import { getDashboardCycles } from "@/lib/cache";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import { internalErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  try {
    const members = await getDashboardCycles();
    return Response.json({ members });
  } catch (error) {
    return internalErrorResponse(error, "Unable to fetch members.");
  }
}
