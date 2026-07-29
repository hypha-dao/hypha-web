import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Compare secrets through their digests so neither length nor content leaks
 * through timing.
 *
 * The digest only exists to hand `timingSafeEqual` two equal-length buffers —
 * it is never persisted, so hash strength is not what protects the secret. What
 * protects it is that the operator generates a high-entropy value (see the
 * integration docs) and keeps it to the ops team.
 *
 * CodeQL flags this as `js/insufficient-password-hash`; the rule assumes a
 * password is being hashed for storage, which is not what happens here.
 */
export function opsSecretMatches(presented: string, expected: string): boolean {
  const digest = (value: string) =>
    createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(presented), digest(expected));
}

export function readOpsSecret(request: NextRequest): string {
  const explicitSecret = request.headers.get('x-hypha-ops-secret')?.trim();
  if (explicitSecret) return explicitSecret;

  const bearerSecret = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  return bearerSecret || '';
}
