/**
 * Safe URL for lead / logo images: same-origin path (not protocol-relative) or http(s) absolute.
 */
export function isSafeImageUrl(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const t = raw.trim();
  if (!t) return false;
  if (t.startsWith('/') && !t.startsWith('//')) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** External link target: absolute http(s) only (no relative or protocol-relative URLs). */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const t = raw.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
