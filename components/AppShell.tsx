"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { firebaseAuth, signOutFirebase } from "@/lib/firebase/client";
import MobileNav from "@/components/MobileNav";
import UserMenu from "@/components/UserMenu";
import { getSsoPartnerUrls } from "@/lib/sso-partners";

const PUBLIC_PATHS = ["/login"];
const SSO_ATTEMPTED_KEY = "bniRrcSsoAttempted";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Spinner />}>
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isNavActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href === "/tasks"
        ? pathname === "/tasks"
        : pathname === href || pathname.startsWith(`${href}/`);

  /**
   * Cross-app SSO with any trusted sibling app (see lib/sso-partners.ts). The contract is
   * `?sso=issue|callback|logout` on any app's root URL rather than dedicated paths, since some
   * sibling apps (Handychapter) are SPAs with no server-side rewrites and can only reliably
   * serve `/` -- a query-string contract works on literally any host/stack.
   */
  const ssoParam = searchParams.get("sso");
  const isKnownSsoParam = ssoParam === "issue" || ssoParam === "callback" || ssoParam === "logout";
  const ssoHandledRef = useRef(false);
  const [ssoBusy, setSsoBusy] = useState(isKnownSsoParam);

  useEffect(() => {
    if (!isKnownSsoParam || ssoHandledRef.current) return;

    if (ssoParam === "logout") {
      ssoHandledRef.current = true;
      window.history.replaceState({}, "", pathname);
      void signOutFirebase().finally(() => setSsoBusy(false));
      return;
    }

    if (ssoParam === "callback") {
      ssoHandledRef.current = true;
      const code = searchParams.get("ssoCode");
      const redirectPath = searchParams.get("redirect") || "/";
      const partnerIndex = Number(searchParams.get("partnerIndex") || "0");
      window.history.replaceState({}, "", pathname);

      const tryNextPartner = () => {
        const partners = getSsoPartnerUrls();
        const nextIndex = partnerIndex + 1;
        if (nextIndex < partners.length) {
          const callback = `${window.location.origin}/?sso=callback&redirect=${encodeURIComponent(redirectPath)}&partnerIndex=${nextIndex}`;
          window.location.replace(`${partners[nextIndex]}/?sso=issue&return=${encodeURIComponent(callback)}`);
        } else {
          router.replace("/login");
          setSsoBusy(false);
        }
      };

      if (!code || code === "none") {
        tryNextPartner();
        return;
      }

      (async () => {
        try {
          const response = await fetch("/api/sso/consume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });

          if (!response.ok) {
            tryNextPartner();
            return;
          }

          const { token } = (await response.json()) as { token: string };
          await signInWithCustomToken(firebaseAuth, token);
          router.replace(redirectPath);
          setSsoBusy(false);
        } catch {
          tryNextPartner();
        }
      })();
      return;
    }

    if (ssoParam === "issue") {
      // Wait for Firebase to finish restoring any persisted session before answering.
      if (loading) return;
      ssoHandledRef.current = true;

      const returnUrl = searchParams.get("return");
      const finish = (query: string) => {
        if (!returnUrl) return;
        const separator = returnUrl.includes("?") ? "&" : "?";
        window.location.replace(`${returnUrl}${separator}${query}`);
      };

      if (!user) {
        finish("ssoCode=none");
        return;
      }

      (async () => {
        try {
          const idToken = await firebaseAuth.currentUser?.getIdToken();
          if (!idToken) {
            finish("ssoCode=none");
            return;
          }

          const response = await fetch("/api/sso/issue", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });

          if (!response.ok) {
            finish("ssoCode=none");
            return;
          }

          const { code } = (await response.json()) as { code: string };
          finish(`ssoCode=${code}`);
        } catch {
          finish("ssoCode=none");
        }
      })();
      return;
    }
  }, [ssoParam, isKnownSsoParam, loading, user, pathname, router, searchParams]);

  useEffect(() => {
    if (ssoBusy || loading || user || isPublicPath) return;

    // Before showing our own login screen, check once per browser session whether any
    // trusted sibling app already has this user signed in, so a session on one app carries
    // over to the others without asking them to log in again.
    const partners = getSsoPartnerUrls();
    if (partners.length > 0 && !sessionStorage.getItem(SSO_ATTEMPTED_KEY)) {
      sessionStorage.setItem(SSO_ATTEMPTED_KEY, "1");
      const callback = `${window.location.origin}/?sso=callback&redirect=${encodeURIComponent(pathname)}&partnerIndex=0`;
      window.location.replace(`${partners[0]}/?sso=issue&return=${encodeURIComponent(callback)}`);
      return;
    }

    router.replace("/login");
  }, [ssoBusy, loading, user, isPublicPath, pathname, router]);

  if (ssoBusy) {
    return <Spinner />;
  }

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (loading || !user) {
    return <Spinner />;
  }

  return (
    <>
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-xl font-semibold tracking-normal">
            BNI Renewal CRM
          </Link>
          <nav className="hidden gap-2 text-sm md:flex">
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/"
            >
              Dashboard
            </Link>
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/achievements") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/achievements"
            >
              Achievements
            </Link>
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/tasks/inbox") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/tasks/inbox"
            >
              Task Inbox
            </Link>
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/tasks") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/tasks"
            >
              Task Buckets
            </Link>
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/import") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/import"
            >
              Import
            </Link>
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:pb-6">{children}</main>
      <MobileNav />
    </>
  );
}
