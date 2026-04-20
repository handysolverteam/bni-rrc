import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import { importTrafficLightReport } from "@/lib/renewals/traffic-light-import";

export const runtime = "nodejs";

async function extractPdfText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  PDFParse.setWorker(
    pathToFileURL(
      path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs"),
    ).toString(),
  );
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    void parser.destroy();
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const reportMonth = formData.get("reportMonth");

    if (!(file instanceof File)) {
      return Response.json({ error: "A .pdf file is required." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return Response.json({ error: "Only PDF traffic-light reports are supported." }, { status: 400 });
    }

    const text = await extractPdfText(file);
    const result = await importTrafficLightReport(
      text,
      file.name,
      typeof reportMonth === "string" && reportMonth ? reportMonth : null,
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
