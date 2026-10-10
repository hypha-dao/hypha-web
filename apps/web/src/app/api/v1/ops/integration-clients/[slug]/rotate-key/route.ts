import { NextRequest, NextResponse } from 'next/server';
import { rotateIntegrationClientKey } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeIntegrationClientOps } from '../../../_lib/authorize-integration-client-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { slug: string };

/**
 * Replace an approved client's key. Hard cut-over: the old key stops working
 * immediately. The new plaintext key is returned by this call only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeIntegrationClientOps(request);
  if (denied) return denied;

  const { slug } = await params;

  try {
    const issued = await rotateIntegrationClientKey({ slug }, { db });
    if (!issued) {
      return NextResponse.json(
        { error: 'No approved client with that slug' },
        { status: 404 },
      );
    }
    return NextResponse.json({
      client: issued.client,
      clientKey: issued.plaintext,
      warning:
        'Store this key now — it is not recoverable. The previous key no longer works.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to rotate integration client key:', {
      slug,
      message,
    });
    return NextResponse.json(
      { error: 'Failed to rotate integration client key' },
      { status: 500 },
    );
  }
}
