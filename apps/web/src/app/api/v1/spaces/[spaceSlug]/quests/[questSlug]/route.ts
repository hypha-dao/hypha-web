import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSpaceQuest,
  schemaPatchSpaceQuest,
  syncSpaceQuestProposalStatuses,
  updateSpaceQuest,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  authorizeQuestRead,
  authorizeQuestWrite,
  questWriteErrorResponse,
} from '../_lib';

type Params = { spaceSlug: string; questSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, questSlug } = await params;
  try {
    const auth = await authorizeQuestRead(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const overview = await syncSpaceQuestProposalStatuses(
      { spaceSlug },
      { db },
    );
    const quest =
      overview?.quests.find((item) => item.slug === questSlug) ?? null;
    if (!quest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }
    return NextResponse.json(quest);
  } catch (error) {
    console.error('[space-quests.detail] failed', error);
    return NextResponse.json(
      { error: 'Failed to load quest' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, questSlug } = await params;
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = schemaPatchSpaceQuest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const result = await updateSpaceQuest(
      {
        spaceSlug,
        questSlug,
        patch: parsed.data,
        actor: auth.actor,
      },
      { db },
    );
    if (!result.ok) return questWriteErrorResponse(result.error);
    return NextResponse.json(result.quest);
  } catch (error) {
    console.error('[space-quests.patch] failed', error);
    return NextResponse.json(
      { error: 'Failed to update quest' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, questSlug } = await params;
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const result = await deleteSpaceQuest(
      {
        spaceSlug,
        questSlug,
        actor: auth.actor,
      },
      { db },
    );
    if (!result.ok) return questWriteErrorResponse(result.error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[space-quests.delete] failed', error);
    return NextResponse.json(
      { error: 'Failed to delete quest' },
      { status: 500 },
    );
  }
}
