/**
 * Trusted sibling apps sharing the same Firebase project (handydash-75858), used for the
 * cross-app SSO handoff (see app/sso/*). A comma-separated list rather than a single URL so
 * adding a third/fourth app later is just an env var change, not a new code path.
 */
export function getSsoPartnerUrls(): string[] {
  const raw = process.env.NEXT_PUBLIC_SSO_PARTNER_URLS || "";
  return raw
    .split(",")
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean);
}
