import { consumeSsoExchangeCode, mintFirebaseCustomToken } from "@/lib/firebase/admin";
import { getSsoPartnerUrls, getSsoHubUrl } from "@/lib/sso-partners";
import { internalErrorResponse } from "@/lib/api-errors";

/**
 * Origins allowed to redeem an SSO exchange code: this app itself (derived from the Host header)
 * plus every configured partner. Only enforced when the caller sends an Origin header; browsers
 * always send it on POSTs, but some (e.g. Safari for same-origin requests) omit it, and a few
 * legitimate server-side clients do too -- those fall back to the code's single-use/60s TTL.
 */
function isTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowed = new Set<string>();
  const host = request.headers.get("host");
  if (host) {
    try {
      // The scheme must be derived, not assumed: hardcoding https made every local
      // (http://localhost) sign-in fail this check, which surfaced as the app falling back to
      // its own login page instead of completing the handoff. x-forwarded-proto is what Vercel
      // and other proxies set; request.url covers local dev where there is no proxy.
      const proto =
        request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
        new URL(request.url).protocol.replace(":", "");
      allowed.add(new URL(`${proto}://${host}`).origin);
    } catch {
      // Unparseable Host header; fall through to the partner allowlist.
    }
  }
  for (const candidate of [...getSsoPartnerUrls(), getSsoHubUrl()]) {
    if (!candidate) continue;
    try {
      allowed.add(new URL(candidate).origin);
    } catch {
      // Config noise; skip.
    }
  }
  return allowed.has(origin);
}

/**
 * Called by AppShell's `?sso=callback` handling with the code a partner app issued. Redeems
 * the code (one-time, ~60s TTL) and mints a Firebase custom token so the browser can call
 * signInWithCustomToken() here without ever showing a login form.
 */
export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return Response.json({ error: "Cross-origin redemption is not allowed." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = body?.code;

  if (!code) {
    return Response.json({ error: "Missing code." }, { status: 400 });
  }

  try {
    const uid = await consumeSsoExchangeCode(code);
    if (!uid) {
      return Response.json({ error: "That sign-in link has expired." }, { status: 400 });
    }

    const token = await mintFirebaseCustomToken(uid);
    return Response.json({ token });
  } catch (error) {
    return internalErrorResponse(error, "Failed to complete SSO sign-in.");
  }
}
