import { NextRequest, NextResponse } from 'next/server';
import { syncSpaceContextProposalStatuses } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextRead } from './_lib';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeContextRead(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const overview = await syncSpaceContextProposalStatuses(
      { spaceSlug },
      { db },
    );
    if (!overview) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[space-context.list] failed', error);
    return NextResponse.json(
      { error: 'Failed to load space context' },
      { status: 500 },
    );
  }
}
