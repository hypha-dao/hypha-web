import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSpaceQuestDraft,
  getSpaceQuestDraft,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeQuestWrite } from '../../_lib';

type Params = { spaceSlug: string; draftId: string };

function draftIdFrom(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, draftId: rawId } = await params;
  const draftId = draftIdFrom(rawId);
  if (!draftId) {
    return NextResponse.json(
      { error: 'Quest draft not found.', code: 'not_found' },
      { status: 404 },
    );
  }
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;
    const draft = await getSpaceQuestDraft(
      { spaceSlug, draftId, authorPersonId: auth.person.id },
      { db },
    );
    if (!draft) {
      return NextResponse.json(
        { error: 'Quest draft not found.', code: 'not_found' },
        { status: 404 },
      );
    }
    return NextResponse.json(draft);
  } catch (error) {
    console.error('[space-quest-drafts.get] failed', error);
    return NextResponse.json(
      { error: 'Failed to load quest draft' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, draftId: rawId } = await params;
  const draftId = draftIdFrom(rawId);
  if (!draftId) {
    return NextResponse.json(
      { error: 'Quest draft not found.', code: 'not_found' },
      { status: 404 },
    );
  }
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;
    const deleted = await deleteSpaceQuestDraft(
      { spaceSlug, draftId, authorPersonId: auth.person.id },
      { db },
    );
    if (deleted === null) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    if (!deleted) {
      return NextResponse.json(
        { error: 'Quest draft not found.', code: 'not_found' },
        { status: 404 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[space-quest-drafts.delete] failed', error);
    return NextResponse.json(
      { error: 'Failed to delete quest draft' },
      { status: 500 },
    );
  }
}
