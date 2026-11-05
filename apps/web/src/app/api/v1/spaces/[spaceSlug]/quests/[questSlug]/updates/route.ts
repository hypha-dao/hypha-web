import { NextRequest, NextResponse } from 'next/server';
import {
  postSpaceQuestUpdate,
  schemaPostQuestUpdate,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { authorizeQuestWrite, questWriteErrorResponse } from '../../_lib';

type Params = { spaceSlug: string; questSlug: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, questSlug } = await params;
  try {
    const auth = await authorizeQuestWrite(request, spaceSlug);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = schemaPostQuestUpdate.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const result = await postSpaceQuestUpdate(
      {
        spaceSlug,
        questSlug,
        input: parsed.data,
        actor: auth.actor,
      },
      { db },
    );
    if (!result.ok) return questWriteErrorResponse(result.error);
    return NextResponse.json(result.quest, { status: 201 });
  } catch (error) {
    console.error('[space-quests.updates] failed', error);
    return NextResponse.json(
      { error: 'Failed to post quest update' },
      { status: 500 },
    );
  }
}
