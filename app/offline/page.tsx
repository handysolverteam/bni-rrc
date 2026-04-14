import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md rounded-md border border-[var(--line)] bg-white p-5">
      <p className="text-sm font-medium text-[var(--accent)]">Offline</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-normal">Connection needed</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Renewal data comes from Supabase, so reconnect to continue working with members,
        tasks, and checklist updates.
      </p>
      <Link
        className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
        href="/"
      >
        Try dashboard
      </Link>
    </div>
  );
}
