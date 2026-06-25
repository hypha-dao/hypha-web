'use server';

import { db } from '@hypha-platform/storage-postgres';
import { findSelf } from '../../people/server/queries';
import { findSpaceBySlug } from '../../space/server/queries';
import { getDb } from '../../common/server/get-db';
import {
  createScheduledItem,
  deleteScheduledItemById,
  updateScheduledItemById,
} from './mutations';
import {
  schemaCreateScheduledItem,
  schemaUpdateScheduledItem,
} from '../validation';

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

  const validated = schemaCreateScheduledItem.parse(data);
  const authDb = getDb({ authToken });
  const self = await findSelf({ db: authDb });
  if (!self?.id) {
    throw new Error('Could not resolve authenticated user');
  }

  const space = spaceSlug?.trim()
    ? await findSpaceBySlug({ slug: spaceSlug.trim() }, { db })
    : null;

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

  const validated = schemaUpdateScheduledItem.parse(data);
  const { id, ...updates } = validated;

  const space = spaceSlug?.trim()
    ? await findSpaceBySlug({ slug: spaceSlug.trim() }, { db })
    : null;

  return updateScheduledItemById(
    { id, ...updates },
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
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to delete a scheduled item');
  }

  return deleteScheduledItemById({ id }, { db });
}
