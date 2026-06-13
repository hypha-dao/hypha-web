/** Strip plus-address suffix before @ for bypass comparison only. */
export function normalizeEmailForBypassComparison(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  const plusIndex = local.indexOf('+');
  const normalizedLocal = plusIndex >= 0 ? local.slice(0, plusIndex) : local;

  return `${normalizedLocal}@${domain}`;
}

export function emailsMatchForBypass(a: string, b: string): boolean {
  return (
    normalizeEmailForBypassComparison(a) ===
    normalizeEmailForBypassComparison(b)
  );
}
