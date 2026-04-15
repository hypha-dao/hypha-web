import { cookies } from 'next/headers';
import { cache } from 'react';
import { decryptOverrides } from 'flags';

const VERCEL_FLAG_OVERRIDES_COOKIE = 'vercel-flag-overrides';

/**
 * Memoize **decrypt only** — do not wrap `cookies()` in `cache()` (Next App Router
 * can treat that as invalid / unstable request usage and surface 500s).
 */
const decryptOverridesOncePerPayload = cache(
  async (
    encrypted: string,
    secret: string,
  ): Promise<Record<string, unknown> | undefined> => {
    try {
      const o = await decryptOverrides(encrypted, secret);
      return o && typeof o === 'object'
        ? (o as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  },
);

/**
 * Vercel Flags Toolbar stores overrides in `vercel-flag-overrides` (JWE).
 * Same shape as `flags/next` `flag()` runtime: map flag **key** → boolean.
 * Requires `FLAGS_SECRET` on the deployment (Vercel project env).
 */
export async function getVercelToolbarFlagOverrides(): Promise<
  Record<string, unknown> | undefined
> {
  try {
    const secret = process.env.FLAGS_SECRET?.trim();
    if (!secret) return undefined;

    const store = await cookies();
    const raw = store.get(VERCEL_FLAG_OVERRIDES_COOKIE)?.value;
    if (!raw) return undefined;

    return decryptOverridesOncePerPayload(raw, secret);
  } catch {
    return undefined;
  }
}

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
