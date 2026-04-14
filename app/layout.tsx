import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BNI Renewal CRM",
  description: "Renewal tracking for BNI chapter members.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--line)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-xl font-semibold tracking-normal">
              BNI Renewal CRM
            </Link>
            <nav className="flex gap-2 text-sm">
              <Link className="rounded-md px-3 py-2 hover:bg-[#eef1ea]" href="/">
                Dashboard
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-[#eef1ea]" href="/import">
                Import
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
