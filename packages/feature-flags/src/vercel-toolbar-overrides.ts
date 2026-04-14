import { cookies } from 'next/headers';
import { cache } from 'react';
import { decryptOverrides } from 'flags';

const VERCEL_FLAG_OVERRIDES_COOKIE = 'vercel-flag-overrides';

/**
 * Vercel Flags Toolbar stores overrides in `vercel-flag-overrides` (JWE).
 * Same shape as `flags/next` `flag()` runtime: map flag **key** → boolean.
 * Requires `FLAGS_SECRET` on the deployment (Vercel project env).
 */
export const getVercelToolbarFlagOverrides = cache(
  async (): Promise<Record<string, unknown> | undefined> => {
    const secret = process.env.FLAGS_SECRET?.trim();
    if (!secret) return undefined;

    const store = await cookies();
    const raw = store.get(VERCEL_FLAG_OVERRIDES_COOKIE)?.value;
    if (!raw) return undefined;

    try {
      const o = await decryptOverrides(raw, secret);
      return o && typeof o === 'object'
        ? (o as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  },
);

export function readBooleanOverride(
  overrides: Record<string, unknown> | undefined,
  flagKey: string,
): boolean | undefined {
  if (!overrides || !Object.hasOwn(overrides, flagKey)) return undefined;
  const v = overrides[flagKey];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}
