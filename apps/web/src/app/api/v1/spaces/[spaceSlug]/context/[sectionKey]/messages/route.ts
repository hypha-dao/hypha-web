import { NextRequest, NextResponse } from 'next/server';
import {
  appendSpaceContextMessage,
  getSpaceContextSection,
  isSpaceContextSectionKey,
  schemaAppendSpaceContextMessage,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeContextRead, authorizeContextWrite } from '../../_lib';

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
    return NextResponse.json({ messages: detail.messages });
  } catch (error) {
    console.error('[space-context.messages] failed', error);
    return NextResponse.json(
      { error: 'Failed to load section chat' },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const parsed = schemaAppendSpaceContextMessage.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const message = await appendSpaceContextMessage(
      {
        spaceSlug,
        sectionKey,
        role: parsed.data.role,
        content: parsed.data.content,
        personId: auth.person.id,
        agentKey: parsed.data.agentKey,
      },
      { db },
    );
    if (!message) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('[space-context.append-message] failed', error);
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 },
    );
  }
}
