import { eq } from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';
import type { DatabaseInstance } from '@hypha-platform/core/server';
import type { RoomSpaceContext } from './types';

/**
 * Map a Matrix room id to its Hypha space/signal context **from our DB only** — never from
 * anything asserted in the transaction payload (any room member can put arbitrary ids in a
 * message).
 *
 *  - `spaces.chat_room_id = roomId`      → the space's chat room
 *  - `coherences.room_id  = roomId`      → a signal thread room (needs its parent space)
 *  - no match                            → `null` (caller records it processed, no dispatch, so
 *                                          the reconciler doesn't re-walk it forever)
 */
export async function resolveRoomToSpace(
  roomId: string,
  db: DatabaseInstance,
): Promise<RoomSpaceContext | null> {
  const trimmed = roomId.trim();
  if (!trimmed) return null;

  const [space] = await db
    .select({ id: spaces.id, slug: spaces.slug })
    .from(spaces)
    .where(eq(spaces.chatRoomId, trimmed))
    .limit(1);

  if (space?.id && space.slug) {
    return { kind: 'space', spaceId: space.id, spaceSlug: space.slug };
  }

  const [signal] = await db
    .select({
      coherenceId: coherences.id,
      spaceId: coherences.spaceId,
      spaceSlug: spaces.slug,
    })
    .from(coherences)
    .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
    .where(eq(coherences.roomId, trimmed))
    .limit(1);

  if (signal?.coherenceId && signal.spaceId && signal.spaceSlug) {
    return {
      kind: 'signal',
      spaceId: signal.spaceId,
      spaceSlug: signal.spaceSlug,
      coherenceId: signal.coherenceId,
    };
  }

  return null;
}
