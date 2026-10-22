import {
  findSpaceBySlug,
  getSpaceBankVirtualAccounts,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

import { extractBearerToken } from '@web/lib/bank-customers/authenticate-bank-customer-request';

type Params = { spaceSlug: string };

export const dynamic = 'force-dynamic';

/** Deposit instructions for anyone funding the space, not only bank admins. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = await verifyPrivyAuthToken(token);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  try {
    const result = await getSpaceBankVirtualAccounts(
      space,
      { spaceSlug, limit: 25 },
      { db },
    );
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error(
      'funding/accounts GET failed:',
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 },
    );
  }
}
