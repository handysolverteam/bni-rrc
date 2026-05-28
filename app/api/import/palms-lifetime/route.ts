import { importLifetimePalmsChapterSummaryReports } from "@/lib/renewals/palms-database-import";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = [
      ...formData.getAll("files"),
      ...formData.getAll("file"),
    ].filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return Response.json({ error: "At least one .xls file is required." }, { status: 400 });
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

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
