import { getTaskInboxItems } from "@/lib/renewals/task-inbox";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  try {
    const tasks = await getTaskInboxItems();
    return Response.json({ tasks });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to load tasks";
    return Response.json({ error: message }, { status: 500 });
  }
}
