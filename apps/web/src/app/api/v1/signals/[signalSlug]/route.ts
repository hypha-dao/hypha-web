import { NextRequest, NextResponse } from 'next/server';

import { findCoherenceBySlugWithSpace } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { signalSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { signalSlug } = await params;
  const trimmedSlug = signalSlug?.trim();
  if (!trimmedSlug) {
    return NextResponse.json(
      { error: 'signalSlug is required' },
      { status: 400 },
    );
  }

  try {
    const signal = await findCoherenceBySlugWithSpace(
      { slug: trimmedSlug },
      { db },
    );
    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    const access = await checkSpaceAccess(request, signal.spaceId);
    if (!access.hasAccess) {
      return (
        access.response ??
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    return NextResponse.json({
      signalSlug: signal.slug,
      signalTitle: signal.title,
      spaceSlug: signal.spaceSlug,
      roomId: signal.roomId,
    });
  } catch (error) {
    console.error('[signals/slug] lookup failed:', error);
    return NextResponse.json(
      { error: 'Failed to resolve signal thread' },
      { status: 500 },
    );
  }
}
