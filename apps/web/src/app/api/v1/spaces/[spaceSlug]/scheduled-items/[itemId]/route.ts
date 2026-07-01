import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  deleteScheduledItemById,
  findScheduledItemById,
  findSpaceBySlug,
  mapScheduledItemRow,
  resolvePersonFromAuthToken,
  safeParseMergedScheduledItemUpdate,
  parseScheduledItemId,
  updateScheduledItemById,
  assertCoherenceInSpace,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { dispatchScheduledItemInvitation } from '@hypha-platform/notifications/server';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string; itemId: string };

async function authorizeRequest(request: NextRequest, spaceSlug: string) {
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    return {
      error: NextResponse.json(
        { error: interactionAuth.message },
        { status: 403 },
      ),
    };
  }

  const self = await resolvePersonFromAuthToken(authToken);
  if (!self?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { authToken, self };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, itemId } = await params;
  const id = parseScheduledItemId(itemId);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const auth = await authorizeRequest(request, spaceSlug);
    if ('error' in auth && auth.error) return auth.error;

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const existing = await findScheduledItemById({ id }, { db });
    if (!existing || existing.spaceId !== space.id) {
      return NextResponse.json(
        { error: 'Scheduled item not found' },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = safeParseMergedScheduledItemUpdate(existing, body, id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id: _id, ...updates } = parsed.data;
    try {
      await assertCoherenceInSpace(
        { coherenceId: updates.coherenceId, spaceId: existing.spaceId },
        { db },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Linked signal must belong to this space',
        },
        { status: 400 },
      );
    }

    const updated = await updateScheduledItemById(
      { id, ...updates },
      {
        db,
        space: { slug: space.slug, chatRoomId: space.chatRoomId ?? null },
        lang: request.headers.get('x-hypha-locale')?.trim() || 'en',
      },
    );

    const lang = request.headers.get('x-hypha-locale')?.trim() || 'en';
    try {
      await dispatchScheduledItemInvitation(
        {
          item: mapScheduledItemRow(updated),
          spaceSlug: space.slug,
          spaceTitle: space.title,
          lang,
        },
        { db },
      );
    } catch (inviteError) {
      console.error(
        'Failed to dispatch scheduled item invitation:',
        inviteError,
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled item' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, itemId } = await params;
  const id = parseScheduledItemId(itemId);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const auth = await authorizeRequest(request, spaceSlug);
    if ('error' in auth && auth.error) return auth.error;

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const existing = await findScheduledItemById({ id }, { db });
    if (!existing || existing.spaceId !== space.id) {
      return NextResponse.json(
        { error: 'Scheduled item not found' },
        { status: 404 },
      );
    }

    await deleteScheduledItemById({ id }, { db });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled item' },
      { status: 500 },
    );
  }
}
