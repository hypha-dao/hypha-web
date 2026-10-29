import { NextRequest, NextResponse } from 'next/server';
import {
  getSpaceContextSection,
  isSpaceContextSectionKey,
  patchSpaceContextSection,
  schemaPatchSpaceContextSection,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextRead, authorizeContextWrite } from '../_lib';

type Params = { spaceSlug: string; sectionKey: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, sectionKey } = await params;
  if (!isSpaceContextSectionKey(sectionKey)) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  }

  try {
    const auth = await authorizeContextRead(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const detail = await getSpaceContextSection(
      { spaceSlug, sectionKey },
      { db },
    );
    if (!detail) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error('[space-context.section] failed', error);
    return NextResponse.json(
      { error: 'Failed to load context section' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, sectionKey } = await params;
  if (!isSpaceContextSectionKey(sectionKey)) {
    return NextResponse.json({ error: 'Unknown section' }, { status: 400 });
  }

  try {
    const auth = await authorizeContextWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = schemaPatchSpaceContextSection.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const section = await patchSpaceContextSection(
      {
        spaceSlug,
        sectionKey,
        markdown: parsed.data.markdown,
        status: parsed.data.status,
        personId: auth.person.id,
      },
      { db },
    );
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    return NextResponse.json(section);
  } catch (error) {
    console.error('[space-context.patch] failed', error);
    return NextResponse.json(
      { error: 'Failed to update context section' },
      { status: 500 },
    );
  }
}
