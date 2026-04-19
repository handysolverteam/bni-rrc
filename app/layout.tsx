import type { Metadata, Viewport } from "next";
import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "BNI Renewal CRM",
  description: "Renewal tracking for BNI chapter members.",
  applicationName: "BNI Renewal CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BNI Renewals",
  },
};

export const viewport: Viewport = {
  themeColor: "#246b4f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <header className="border-b border-[var(--line)] bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-xl font-semibold tracking-normal">
              BNI Renewal CRM
            </Link>
            <nav className="hidden gap-2 text-sm md:flex">
              <Link className="focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea]" href="/">
                Dashboard
              </Link>
              <Link className="focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea]" href="/tasks">
                Tasks
              </Link>
              <Link className="focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea]" href="/import">
                Import
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6">{children}</main>
        <MobileNav />
      </body>
    </html>
  );
}
