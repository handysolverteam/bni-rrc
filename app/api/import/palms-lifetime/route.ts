import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { importLifetimePalmsChapterSummaryReports } from "@/lib/renewals/palms-database-import";
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
    const files = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "At least one .xls file is required." }, { status: 400 });
    }

    if (filesExceedLimit(files)) {
      return importTooLargeResponse();
    }

    const invalidFile = files.find((file) => !file.name.toLowerCase().endsWith(".xls"));

    if (invalidFile) {
      return Response.json(
        { error: `Only .xls SpreadsheetML PALMS reports are supported. Invalid file: ${invalidFile.name}` },
        { status: 400 },
      );
    }

    const payload = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        xml: await file.text(),
      })),
    );
    const result = await importLifetimePalmsChapterSummaryReports(payload);

    await invalidateCache([CACHE_TAGS.members, CACHE_TAGS.imports]);
    return Response.json(result);
  } catch (error) {
    return internalErrorResponse(error, "Import failed.");
  }
}
