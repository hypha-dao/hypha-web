/**
 * Strips a `+tag` plus-address suffix and lowercases, for the bypass ownership compare only
 * (decision D5) — `me+test@x.com` ≡ `me@x.com` when checking "is the submitter the email owner".
 * The original, unmodified email is always what's sent to Bridge and stored: Bridge treats
 * `user+tag@x.com` as a distinct customer, which is intentional for sandbox testing.
 */
export function normalizeEmailForBypass(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) {
    return trimmed;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex);
  const plusIndex = localPart.indexOf('+');
  const normalizedLocalPart =
    plusIndex === -1 ? localPart : localPart.slice(0, plusIndex);

  return `${normalizedLocalPart}${domain}`;
}

/** Is `submitterEmail` (the authorized submitter's own `people.email`) the owner of `contactEmail`? */
export function isBypassEligible(
  submitterEmail: string | null,
  contactEmail: string,
): boolean {
  if (!submitterEmail) {
    return false;
  }
  return (
    normalizeEmailForBypass(submitterEmail) ===
    normalizeEmailForBypass(contactEmail)
  );
}
