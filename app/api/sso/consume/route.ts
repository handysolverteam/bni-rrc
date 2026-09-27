import { consumeSsoExchangeCode, mintFirebaseCustomToken } from "@/lib/firebase/admin";
import { getSsoPartnerUrls } from "@/lib/sso-partners";
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
      allowed.add(new URL(`https://${host}`).origin);
    } catch {
      // Unparseable Host header; fall through to the partner allowlist.
    }
  }
  for (const partner of getSsoPartnerUrls()) {
    try {
      allowed.add(new URL(partner).origin);
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
