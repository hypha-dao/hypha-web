import { NextRequest, NextResponse } from 'next/server';
import { revokeIntegrationClient } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeIntegrationClientOps } from '../../../_lib/authorize-integration-client-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { slug: string };

/** Revoke a pending (reject) or approved client. Revoked is terminal. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeIntegrationClientOps(request);
  if (denied) return denied;

  const { slug } = await params;

  try {
    const revoked = await revokeIntegrationClient({ slug }, { db });
    if (!revoked) {
      return NextResponse.json(
        { error: 'No pending or approved client with that slug' },
        { status: 404 },
      );
    }
    return NextResponse.json({ revoked: true, slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to revoke integration client:', { slug, message });
    return NextResponse.json(
      { error: 'Failed to revoke integration client' },
      { status: 500 },
    );
  }
}
