import { firebaseAuth } from "./firebase/client";

/**
 * Returns the caller's current Firebase ID token (or null when signed out).
 * The browser profile on this app uses phone/OAuth sign-in via firebaseAuth,
 * and Firebase refreshes the token automatically, so no manual forceRefresh is
 * needed here.
 */
export async function getCurrentIdToken(): Promise<string | null> {
  const currentUser = firebaseAuth.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

/**
 * fetch() with the caller's Firebase ID token attached as a Bearer token.
 * Every app API route (except SSO code exchange) requires it -- always use
 * this instead of bare fetch() for /api/* calls so UI actions keep working
 * now that all routes verify authentication server-side.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCurrentIdToken();
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
