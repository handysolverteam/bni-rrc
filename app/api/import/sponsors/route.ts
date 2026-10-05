import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { importSponsorReport } from "@/lib/renewals/sponsor-database-import";
import { requireApiAuth, unauthorizedResponse } from "@/lib/require-api-auth";
import {
  contentLengthExceedsLimit,
  filesExceedLimit,
  importTooLargeResponse,
} from "@/lib/import-guard";
import { internalErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    await requireApiAuth(request);
  } catch {
    return unauthorizedResponse();
  }

  try {
    if (contentLengthExceedsLimit(request)) {
      return importTooLargeResponse();
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "A .xls file is required." }, { status: 400 });
    }

    if (filesExceedLimit([file])) {
      return importTooLargeResponse();
    }

    if (!file.name.toLowerCase().endsWith(".xls")) {
      return Response.json(
        { error: "Only .xls SpreadsheetML sponsor reports are supported." },
        { status: 400 },
      );
    }

    const result = await importSponsorReport(await file.text(), file.name);
    await invalidateCache([CACHE_TAGS.members]);
    return Response.json(result);
  } catch (error) {
    return internalErrorResponse(error, "Import failed.");
  }
}
