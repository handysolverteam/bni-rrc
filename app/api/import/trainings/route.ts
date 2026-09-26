import { CACHE_TAGS, invalidateCache } from "@/lib/cache";
import { importTrainingReport } from "@/lib/renewals/training-database-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "A .xls file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xls")) {
      return Response.json(
        { error: "Only .xls SpreadsheetML training reports are supported." },
        { status: 400 },
      );
    }

    const result = await importTrainingReport(await file.text(), file.name);
    await invalidateCache([CACHE_TAGS.members]);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
