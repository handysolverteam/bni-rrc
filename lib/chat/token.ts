import { firebaseAuth } from "@/lib/firebase/client";

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