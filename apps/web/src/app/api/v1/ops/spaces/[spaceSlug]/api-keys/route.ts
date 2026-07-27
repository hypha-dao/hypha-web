import { NextRequest, NextResponse } from 'next/server';
import {
  createSpaceApiKey,
  findSpaceBySlug,
  listSpaceApiKeys,
  schemaCreateSpaceApiKey,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeSpaceApiKeyOps } from './_lib/authorize-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { spaceSlug: string };

/**
 * Issue an integration key for a space.
 *
 * Deliberately behind the ops secret rather than space membership: a space can
 * be fully public, and anyone able to read a space must never be able to read
 * or mint its write credentials. The plaintext key is returned by this call
 * only — afterwards only its SHA-256 digest exists.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeSpaceApiKeyOps(request);
  if (denied) return denied;

  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = schemaCreateSpaceApiKey.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const existing = await listSpaceApiKeys({ spaceId: space.id }, { db });
    if (
      existing.some(
        (key) => key.source === parsed.data.source && key.revokedAt === null,
      )
    ) {
      return NextResponse.json(
        {
          error: `An active key already exists for source "${parsed.data.source}". Revoke it before issuing a replacement.`,
        },
        { status: 409 },
      );
    }

    const { key, plaintext } = await createSpaceApiKey(
      { spaceId: space.id, ...parsed.data },
      { db },
    );

    return NextResponse.json(
      {
        key,
        apiKey: plaintext,
        warning:
          'Store this key now — it is not recoverable. Never expose it in client-side code.',
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to issue space API key:', { spaceSlug, message });
    return NextResponse.json(
      { error: 'Failed to issue space API key' },
      { status: 500 },
    );
  }
}

/** List key metadata for a space. Never returns key material. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeSpaceApiKeyOps(request);
  if (denied) return denied;

  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const keys = await listSpaceApiKeys({ spaceId: space.id }, { db });
    return NextResponse.json({ keys });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to list space API keys:', { spaceSlug, message });
    return NextResponse.json(
      { error: 'Failed to list space API keys' },
      { status: 500 },
    );
  }
}
