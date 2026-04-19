import { getTaskInboxItems } from "@/lib/renewals/task-inbox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await getTaskInboxItems();
    return Response.json({ tasks });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unable to load tasks";
    return Response.json({ error: message }, { status: 500 });
  }
}
