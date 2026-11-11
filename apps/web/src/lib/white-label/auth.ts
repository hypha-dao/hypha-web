import { normaliseHost } from './config';
import type { WhiteLabelAuthConfig } from './types';

/**
 * Carries a host's auth config from middleware to the root layout as a request
 * header (public values only). Middleware sets it after stripping incoming
 * copies; the layout re-validates before use, so a malformed value reads as
 * "no auth config".
 */
export function serializeAuthConfig(config: WhiteLabelAuthConfig): string {
  return JSON.stringify({
    privyClientId: config.privyClientId,
    cookieDomain: config.cookieDomain,
  });
}

export function readAuthConfigHeader(
  raw: string | null | undefined,
): WhiteLabelAuthConfig | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const { privyClientId, cookieDomain } = json as Record<string, unknown>;
  if (
    typeof privyClientId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(privyClientId)
  ) {
    return null;
  }
  const domain = normaliseHost(cookieDomain);
  if (domain === null || domain.includes(':')) return null;
  return { privyClientId, cookieDomain: domain };
}
