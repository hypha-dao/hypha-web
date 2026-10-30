import { NextRequest, NextResponse } from 'next/server';
import {
  markSpaceContextSectionsProposed,
  schemaProposeSpaceContext,
} from '@hypha-platform/core/server';
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

    const body = await request.json();
    const parsed = schemaProposeSpaceContext.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const sections = await markSpaceContextSectionsProposed(
      {
        spaceSlug,
        sectionKeys: parsed.data.sectionKeys,
        documentId: parsed.data.documentId,
        personId: auth.person.id,
      },
      { db },
    );
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[space-context.propose] failed', error);
    return NextResponse.json(
      { error: 'Failed to mark sections as proposed' },
      { status: 500 },
    );
  }
}
