export default function Loading() {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md border border-[var(--line)] bg-white p-6">
        <div className="h-4 w-40 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-4 h-3 w-full animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-[var(--line)]" />
        <div className="mt-6 h-3 w-1/3 animate-pulse rounded bg-[var(--line)]" />
      </div>
    </div>
  );
}