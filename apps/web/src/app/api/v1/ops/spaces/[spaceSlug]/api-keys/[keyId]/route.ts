import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  revokeSpaceApiKey,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeSpaceApiKeyOps } from '../_lib/authorize-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string; keyId: string };

/** Revoke a key. Idempotent: revoking an already-revoked key returns 404. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeSpaceApiKeyOps(request);
  if (denied) return denied;

  const { spaceSlug, keyId } = await params;
  const id = Number.parseInt(keyId, 10);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Invalid key id' }, { status: 400 });
  }

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const revoked = await revokeSpaceApiKey({ id, spaceId: space.id }, { db });
    if (!revoked) {
      return NextResponse.json(
        { error: 'No active key with that id for this space' },
        { status: 404 },
      );
    }

    return NextResponse.json({ revoked: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to revoke space API key:', {
      spaceSlug,
      keyId,
      message,
    });
    return NextResponse.json(
      { error: 'Failed to revoke space API key' },
      { status: 500 },
    );
  }
}
