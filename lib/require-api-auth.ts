import { verifyFirebaseIdToken } from "./firebase/admin";

/**
 * Standard gate for every authenticated API route. The browser holds the
 * Firebase ID token in memory (AuthContext) and sends it as a Bearer token;
 * the server re-verifies it on each call. Service-role Supabase access inside
 * route handlers bypasses RLS, so this check is the only thing standing
 * between anonymous HTTP traffic and the full database -- never skip it.
 */
export async function requireApiAuth(request: Request): Promise<{ uid: string; email: string | null }> {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    throw new Error("Missing bearer token.");
  }

  return verifyFirebaseIdToken(idToken);
}

/** 401 JSON response shared by all authenticated routes. */
export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized." }, { status: 401 });
}
