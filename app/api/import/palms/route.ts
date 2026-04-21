import { importPalmsChapterSummaryReport } from "@/lib/renewals/palms-database-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "A .xls file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xls")) {
      return Response.json({ error: "Only .xls SpreadsheetML PALMS reports are supported." }, { status: 400 });
    }

    const xml = await file.text();
    const result = await importPalmsChapterSummaryReport(xml, file.name);

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
