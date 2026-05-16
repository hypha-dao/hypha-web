import type { NextRequest } from 'next/server';

export function readOpsSecret(request: NextRequest): string {
  return (
    request.headers.get('x-hypha-ops-secret')?.trim() ??
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim() ??
    ''
  );
}
