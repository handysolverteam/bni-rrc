import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-white/95 px-4 py-2 backdrop-blur md:hidden mobile-safe-bottom">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        <Link
          className={`focus-ring flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${isActive("/") ? "bg-[var(--accent)] text-white" : "bg-[#eef1ea]"}`}
          href="/"
        >
          Dashboard
        </Link>
        <Link
          className={`focus-ring flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${isActive("/achievements") ? "bg-[var(--accent)] text-white" : "bg-[#eef1ea]"}`}
          href="/achievements"
        >
          Awards
        </Link>
        <Link
          className={`focus-ring flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${isActive("/tasks/inbox") ? "bg-[var(--accent)] text-white" : "bg-[#eef1ea]"}`}
          href="/tasks/inbox"
        >
          Inbox
        </Link>
        <Link
          className={`focus-ring flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${isActive("/import") ? "bg-[var(--accent)] text-white" : "bg-[#eef1ea]"}`}
          href="/import"
        >
          Import
        </Link>
        <Link
          className={`focus-ring flex min-h-11 items-center justify-center rounded-md text-sm font-medium ${isActive("/chat") ? "bg-[var(--accent)] text-white" : "bg-[#eef1ea]"}`}
          href="/chat"
        >
          Chat
        </Link>
      </div>
    </nav>
  );
}