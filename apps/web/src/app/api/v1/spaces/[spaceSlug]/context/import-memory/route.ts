import { NextRequest, NextResponse } from 'next/server';
import { importSpaceContextFromMemory } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextWrite } from '../_lib';

type Params = { spaceSlug: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeContextWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const overview = await importSpaceContextFromMemory(
      {
        spaceSlug,
        personId: auth.person.id,
        authToken: auth.token,
        requestUrlForSessionMatrix: request.url,
      },
      { db },
    );
    if (!overview) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[space-context.import-memory] failed', error);
    return NextResponse.json(
      { error: 'Failed to import from Space Memory' },
      { status: 500 },
    );
  }
}
