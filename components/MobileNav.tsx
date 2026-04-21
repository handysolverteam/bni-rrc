import Link from "next/link";

export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-white/95 px-4 py-2 backdrop-blur md:hidden mobile-safe-bottom">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        <Link
          className="focus-ring flex min-h-11 items-center justify-center rounded-md bg-[#eef1ea] text-sm font-medium"
          href="/"
        >
          Dashboard
        </Link>
        <Link
          className="focus-ring flex min-h-11 items-center justify-center rounded-md bg-[#eef1ea] text-sm font-medium"
          href="/achievements"
        >
          Awards
        </Link>
        <Link
          className="focus-ring flex min-h-11 items-center justify-center rounded-md bg-[#eef1ea] text-sm font-medium"
          href="/tasks/inbox"
        >
          Inbox
        </Link>
        <Link
          className="focus-ring flex min-h-11 items-center justify-center rounded-md bg-[#eef1ea] text-sm font-medium"
          href="/import"
        >
          Import
        </Link>
      </div>
    </nav>
  );
}
