import { NextRequest, NextResponse } from 'next/server';
import {
  schemaSuggestSpaceContextSection,
  suggestSpaceContextSection,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextWrite, contextWriteErrorResponse } from '../_lib';

type Params = { spaceSlug: string };

/**
 * Suggest a new Context section (or restoring a removed one). It stays a
 * draft suggestion until a proposal adding it passes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeContextWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = schemaSuggestSpaceContextSection.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const result = await suggestSpaceContextSection(
      { ...parsed.data, spaceSlug, personId: auth.person.id },
      { db },
    );
    if (!result.ok) return contextWriteErrorResponse(result.error);
    return NextResponse.json(result.section, { status: 201 });
  } catch (error) {
    console.error('[space-context.suggest] failed', error);
    return NextResponse.json(
      { error: 'Failed to suggest the section' },
      { status: 500 },
    );
  }
}
