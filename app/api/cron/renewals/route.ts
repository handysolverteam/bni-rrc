import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { generateRenewalTasks } from "@/lib/renewals/tasks";
import { internalErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || providedSecret !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateRenewalTasks();
    await invalidateCache([CACHE_TAGS.renewals]);
    return Response.json(result);
  } catch (error) {
    return internalErrorResponse(error, "Cron failed.");
  }
}
