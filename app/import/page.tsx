import ImportForm from "@/components/ImportForm";
import { getPalmsMonthlyCoverage } from "@/lib/cache";

export const revalidate = 60;

export default async function ImportPage() {
  const coverage = await getPalmsMonthlyCoverage();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--accent)]">Imports</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Import members</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Upload membership dues reports for renewal cycles, monthly traffic-light PDFs for member
          scores, PALMS chapter summaries for lifetime achievement totals, sponsor reports for
          sponsor recognition, and training reports for lifetime and past-year training counts.
        </p>
      </div>
      <ImportForm coverage={coverage} />
    </div>
  );
}
