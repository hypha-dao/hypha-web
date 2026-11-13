import { NextRequest, NextResponse } from 'next/server';
import {
  assistSpaceQuestDraft,
  questDraftAssistRequestSchema,
} from '@hypha-platform/chat-server';
import { questSchemaErrorPayload } from '@hypha-platform/core/server';
import { authorizeQuestWrite } from '../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

type Params = { spaceSlug: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const auth = await authorizeQuestWrite(request, spaceSlug);
  if (!auth.ok) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = questDraftAssistRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(questSchemaErrorPayload(parsed.error), {
      status: 400,
    });
  }

  const result = await assistSpaceQuestDraft({
    spaceSlug,
    input: parsed.data,
    actor: auth.actor,
  });
  return NextResponse.json(result);
}
