"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { firebaseAuth, signOutFirebase } from "@/lib/firebase/client";
import MobileNav from "@/components/MobileNav";
import UserMenu from "@/components/UserMenu";
import { getSsoHubUrl, getSsoPartnerUrls, SSO_ATTEMPTED_KEY, clearSsoAttempted } from "@/lib/sso-partners";
import { isSafeInternalPath, isSafeSsoReturnUrl } from "@/lib/sso-guard";

const PUBLIC_PATHS = ["/login"];

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
    </div>
  );
}

function AccessRequired() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-lg font-semibold tracking-normal">Access required</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {user?.displayName || user?.email || "Your account"} doesn&apos;t have access to this app yet. Ask a
          Handychapter admin to grant it from the Chapter tab.
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="focus-ring mt-6 w-full rounded-md border border-[var(--line)] px-3 py-2 text-sm font-medium hover:bg-[#eef1ea]"
        >
          Sign out
        </button>
      </div>
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
      clearSsoAttempted();
      void signOutFirebase().finally(() => setSsoBusy(false));
      return;
    }

    if (ssoParam === "callback") {
      ssoHandledRef.current = true;
      const code = searchParams.get("ssoCode");
      const rawRedirectPath = searchParams.get("redirect") || "/";
      const redirectPath = isSafeInternalPath(rawRedirectPath) ? rawRedirectPath : "/";
      window.history.replaceState({}, "", pathname);

      // The hub always either authenticates the user (showing its own login screen if it had
      // to) or genuinely fails -- there's no partner chain to fall through any more. A missing
      // code here is unexpected; the local /login page is the safety net.
      const bail = () => {
        router.replace("/login");
        setSsoBusy(false);
      };

      if (!code || code === "none") {
        bail();
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
            bail();
            return;
          }

          const { token } = (await response.json()) as { token: string };
          await signInWithCustomToken(firebaseAuth, token);
          router.replace(redirectPath);
          setSsoBusy(false);
        } catch {
          bail();
        }
      })();
      return;
    }

    if (ssoParam === "issue") {
      // Wait for Firebase to finish restoring any persisted session before answering.
      if (loading) return;
      ssoHandledRef.current = true;

      const returnUrl = searchParams.get("return");
      const safeReturn = isSafeSsoReturnUrl(returnUrl || "", window.location.origin, getSsoPartnerUrls());
      const finish = (query: string) => {
        if (!safeReturn) return;
        const separator = returnUrl!.includes("?") ? "&" : "?";
        window.location.replace(`${returnUrl}${separator}${query}`);
      };

      if (!safeReturn) {
        // Unguarded `return` target (missing or attacker-controlled): do not mint a code or
        // bounce anywhere. Treat the visit as a normal page load of this app.
        window.history.replaceState({}, "", pathname);
        queueMicrotask(() => setSsoBusy(false));
        return;
      }

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

  /**
   * Authorization (distinct from authentication): being signed in via the hub doesn't mean
   * this member has been granted access to THIS app. Handychapter admins grant it per member
   * via the "rrc" committee tag, which sync-committee-tag mirrors into this same Firebase
   * project as a custom claim of the same name -- checked straight from the ID token, no
   * cross-database query needed. Force-refreshed once per session so a just-granted/revoked
   * change doesn't wait for the token's normal ~hour refresh cycle.
   */
  const accessCheckedRef = useRef(false);
  const [accessState, setAccessState] = useState<"checking" | "granted" | "denied">("checking");

  useEffect(() => {
    if (loading || !user || accessCheckedRef.current) return;
    accessCheckedRef.current = true;

    (async () => {
      try {
        const result = await firebaseAuth.currentUser?.getIdTokenResult(true);
        setAccessState(result?.claims.rrc === true ? "granted" : "denied");
      } catch {
        setAccessState("denied");
      }
    })();
  }, [loading, user]);

  useEffect(() => {
    if (ssoBusy || loading || user || isPublicPath) return;

    // No local session: defer to the single auth hub (Handychapter) rather than showing our
    // own login screen. The hub either already has a session (bounces back silently) or shows
    // its own login form and bounces back once the user completes it -- either way we land
    // back here authenticated. Once per browser session, so a down/misconfigured hub falls
    // through to our own /login (kept as a safety net) instead of looping.
    const hubUrl = getSsoHubUrl();
    if (hubUrl && !sessionStorage.getItem(SSO_ATTEMPTED_KEY)) {
      sessionStorage.setItem(SSO_ATTEMPTED_KEY, "1");
      const callback = `${window.location.origin}/?sso=callback&redirect=${encodeURIComponent(pathname)}`;
      window.location.replace(`${hubUrl}/?sso=issue&return=${encodeURIComponent(callback)}`);
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

  if (loading || !user || accessState === "checking") {
    return <Spinner />;
  }

  if (accessState === "denied") {
    return <AccessRequired />;
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
            <Link
              className={`focus-ring flex min-h-11 items-center rounded-md px-3 py-2 hover:bg-[#eef1ea] ${isNavActive("/chat") ? "bg-[#eef1ea] font-medium" : ""}`}
              href="/chat"
            >
              Chat
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
