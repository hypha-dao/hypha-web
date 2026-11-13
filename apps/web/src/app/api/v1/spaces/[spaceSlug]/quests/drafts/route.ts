import { NextRequest, NextResponse } from 'next/server';
import {
  listSpaceQuestDrafts,
  saveSpaceQuestDraft,
  schemaSaveQuestDraft,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeQuestWrite } from '../_lib';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;
    const drafts = await listSpaceQuestDrafts(
      { spaceSlug, authorPersonId: auth.person.id },
      { db },
    );
    if (!drafts) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('[space-quest-drafts.list] failed', error);
    return NextResponse.json(
      { error: 'Failed to load quest drafts' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const parsed = schemaSaveQuestDraft.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid quest draft.', code: 'invalid_input' },
        { status: 400 },
      );
    }
    const saved = await saveSpaceQuestDraft(
      {
        spaceSlug,
        authorPersonId: auth.person.id,
        id: parsed.data.id,
        payload: parsed.data.payload,
      },
      { db },
    );
    if (!saved) {
      return NextResponse.json(
        { error: 'Quest draft not found.', code: 'not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json(saved, { status: parsed.data.id ? 200 : 201 });
  } catch (error) {
    console.error('[space-quest-drafts.save] failed', error);
    return NextResponse.json(
      { error: 'Failed to save quest draft' },
      { status: 500 },
    );
  }
}
