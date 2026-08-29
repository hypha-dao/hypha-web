import { confirmBankEmail } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public endpoint (#2288) — no Privy auth: the confirmation JWT itself is the authorization (D4).
 * Owner-agnostic — the JWT payload carries whether it's a space or a person.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const token =
    typeof body === 'object' && body !== null && 'token' in body
      ? (body as { token: unknown }).token
      : null;

  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const result = await confirmBankEmail(token, { db });

    if (!result.ok) {
      const status = result.reason === 'already_confirmed' ? 409 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status, headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ownerType: result.ownerType,
        ownerLabel: result.ownerLabel,
        kycLink: result.kycLink,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error(
      'banking/token-confirmation POST failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to confirm bank email' },
      { status: 500 },
    );
  }
}
