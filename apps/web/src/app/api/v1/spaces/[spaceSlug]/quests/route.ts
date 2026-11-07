import { NextRequest, NextResponse } from 'next/server';
import {
  createSpaceQuest,
  schemaCreateSpaceQuest,
  syncSpaceQuestProposalStatuses,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  authorizeQuestRead,
  authorizeQuestWrite,
  questWriteErrorResponse,
} from './_lib';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const auth = await authorizeQuestRead(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const overview = await syncSpaceQuestProposalStatuses(
      { spaceSlug },
      { db },
    );
    if (!overview) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json(overview);
  } catch (error) {
    console.error('[space-quests.list] failed', error);
    return NextResponse.json(
      { error: 'Failed to load space quests' },
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
    const parsed = schemaCreateSpaceQuest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const result = await createSpaceQuest(
      {
        spaceSlug,
        input: parsed.data,
        actor: auth.actor,
      },
      { db },
    );
    if (!result.ok) return questWriteErrorResponse(result.error);
    return NextResponse.json(result.quest, { status: 201 });
  } catch (error) {
    console.error('[space-quests.create] failed', error);
    return NextResponse.json(
      { error: 'Failed to create quest' },
      { status: 500 },
    );
  }
}
