import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Compare secrets through their digests so neither length nor content leaks
 * through timing.
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
