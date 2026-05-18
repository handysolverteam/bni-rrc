import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";
import {
  formatImportError,
  importTrafficLightReport,
  importTrafficLightXlsxReport,
} from "@/lib/renewals/traffic-light-import";

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
      return Response.json({ error: "A .pdf or .xlsx file is required." }, { status: 400 });
    }

    const filename = file.name.toLowerCase();

    if (!filename.endsWith(".pdf") && !filename.endsWith(".xlsx")) {
      return Response.json({ error: "Only PDF or XLSX traffic-light reports are supported." }, { status: 400 });
    }

    const normalizedReportMonth = typeof reportMonth === "string" && reportMonth ? reportMonth : null;
    const result = filename.endsWith(".xlsx")
      ? await importTrafficLightXlsxReport(Buffer.from(await file.arrayBuffer()), file.name, normalizedReportMonth)
      : await importTrafficLightReport(await extractPdfText(file), file.name, normalizedReportMonth);

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: formatImportError(error) },
      { status: 500 },
    );
  }
}
