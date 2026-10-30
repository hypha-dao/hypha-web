import { NextRequest, NextResponse } from 'next/server';
import {
  isSpaceContextSectionKey,
  saveSpaceContextAgentMemory,
  schemaSaveSpaceContextMemory,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextWrite } from '../../_lib';

type Params = { spaceSlug: string; sectionKey: string };

export async function PUT(
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
    const parsed = schemaSaveSpaceContextMemory.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const ok = await saveSpaceContextAgentMemory(
      {
        spaceSlug,
        sectionKey,
        memoryMarkdown: parsed.data.memoryMarkdown,
      },
      { db },
    );
    if (!ok) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[space-context.memory] failed', error);
    return NextResponse.json(
      { error: 'Failed to save specialist memory' },
      { status: 500 },
    );
  }
}
