import { verifyFirebaseIdToken } from "../firebase/admin";

/**
 * Defense-in-depth auth for chat routes. AppShell already blocks unauthenticated
 * pages, but chat additionally forwards the live chapter snapshot to the LLM, so
 * each chat API call re-verifies the caller's Firebase ID token server-side.
 */
export async function requireChatAuth(request: Request): Promise<{ uid: string; email: string | null }> {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!idToken) {
    throw new Error("Missing bearer token.");
  }

  return verifyFirebaseIdToken(idToken);
}