import type { NextRequest } from 'next/server';

export function readOpsSecret(request: NextRequest): string {
  const explicitSecret = request.headers.get('x-hypha-ops-secret')?.trim();
  if (explicitSecret) return explicitSecret;

  const bearerSecret = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim();
  return bearerSecret || '';
}
