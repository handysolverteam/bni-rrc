import ImportForm from "@/components/ImportForm";

export default function ImportPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-[var(--accent)]">Membership dues report</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal">Import members</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Upload the BNI Chapter Membership Dues Report `.xls` file to create members and yearly
          renewal cycles.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
