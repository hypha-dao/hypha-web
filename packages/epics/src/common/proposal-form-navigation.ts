'use client';

/** Normalize app paths for same-route checks (trailing slashes, query/hash stripped). */
export function normalizeAppPath(path: string | null | undefined): string {
  if (!path?.trim()) return '';
  const withoutQuery = path.split(/[?#]/)[0] ?? path;
  return withoutQuery.replace(/\/+$/, '') || '/';
}

export function isSameAppPath(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeAppPath(a);
  const right = normalizeAppPath(b);
  return Boolean(left && right && left === right);
}

export function isProposalCreateFormPath(
  path: string | null | undefined,
): boolean {
  return normalizeAppPath(path).includes('/agreements/create/');
}

export function stableJsonFingerprint(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}
