'use server';

import { db } from '@hypha-platform/storage-postgres';
import { authorizeSpacePanelInteraction } from '../../space/server/authorize-space-panel-interaction';
import { findSelf } from '../../people/server/queries';
import { findSpaceBySlug } from '../../space/server/queries';
import { getDb } from '../../common/server/get-db';
import {
  createScheduledItem,
  deleteScheduledItemById,
  updateScheduledItemById,
} from './mutations';
import { findScheduledItemById } from './queries';
import { safeParseMergedScheduledItemUpdate } from './merge-scheduled-item-update';
import { assertCoherenceInSpace } from './assert-coherence-in-space';
import { schemaCreateScheduledItem } from '../validation';

async function assertScheduledItemSpaceAccess(
  authToken: string,
  spaceSlug?: string,
) {
  const slug = spaceSlug?.trim();
  if (!slug) {
    throw new Error('spaceSlug is required to modify scheduled items');
  }

  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug: slug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    throw new Error(interactionAuth.message);
  }
}

export async function createScheduledItemAction(
  data: unknown,
  {
    authToken,
    spaceSlug,
    lang,
  }: { authToken?: string; spaceSlug?: string; lang?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to create a scheduled item');
  }

  await assertScheduledItemSpaceAccess(authToken, spaceSlug);

  const validated = schemaCreateScheduledItem.parse(data);
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user');
  }

  const space = spaceSlug?.trim()
    ? await findSpaceBySlug({ slug: spaceSlug.trim() }, { db })
    : null;
  if (space && validated.spaceId !== space.id) {
    throw new Error('Scheduled item space does not match the requested space');
  }

  await assertCoherenceInSpace(
    { coherenceId: validated.coherenceId, spaceId: validated.spaceId },
    { db },
  );

  return createScheduledItem(
    {
      ...validated,
      creatorId: self.id,
    },
    {
      db,
      space: space
        ? { slug: space.slug, chatRoomId: space.chatRoomId ?? null }
        : undefined,
      lang,
    },
  );
}

export async function updateScheduledItemAction(
  data: unknown,
  {
    authToken,
    spaceSlug,
    lang,
  }: { authToken?: string; spaceSlug?: string; lang?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to update a scheduled item');
  }

  await assertScheduledItemSpaceAccess(authToken, spaceSlug);

  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user');
  }

  if (typeof data !== 'object' || data == null || !('id' in data)) {
    throw new Error('Scheduled item id is required');
  }

  const incoming = data as Record<string, unknown> & { id: number };
  const existing = await findScheduledItemById({ id: incoming.id }, { db });
  if (!existing) {
    throw new Error('Scheduled item not found');
  }

  const space = spaceSlug?.trim()
    ? await findSpaceBySlug({ slug: spaceSlug.trim() }, { db })
    : null;
  if (space && existing.spaceId !== space.id) {
    throw new Error('Scheduled item not found in this space');
  }

  const parsed = safeParseMergedScheduledItemUpdate(
    existing,
    incoming,
    incoming.id,
  );
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join('; '),
    );
  }
  const { id, ...mergedUpdates } = parsed.data;

  await assertCoherenceInSpace(
    {
      coherenceId: mergedUpdates.coherenceId,
      spaceId: existing.spaceId,
    },
    { db },
  );

  return updateScheduledItemById(
    { id, ...mergedUpdates },
    {
      db,
      space: space
        ? { slug: space.slug, chatRoomId: space.chatRoomId ?? null }
        : undefined,
      lang,
    },
  );
}

export async function deleteScheduledItemAction(
  { id }: { id: number },
  { authToken, spaceSlug }: { authToken?: string; spaceSlug?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to delete a scheduled item');
  }

  await assertScheduledItemSpaceAccess(authToken, spaceSlug);

  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user');
  }

  const existing = await findScheduledItemById({ id }, { db });
  if (!existing) {
    throw new Error('Scheduled item not found');
  }

  const space = spaceSlug?.trim()
    ? await findSpaceBySlug({ slug: spaceSlug.trim() }, { db })
    : null;
  if (space && existing.spaceId !== space.id) {
    throw new Error('Scheduled item not found in this space');
  }

  return deleteScheduledItemById({ id }, { db });
}
