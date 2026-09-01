import {
  notificationProcessedEvents,
  type NewNotificationProcessedEvent,
} from '@hypha-platform/storage-postgres';
import type { DatabaseInstance } from '@hypha-platform/core/server';

/**
 * Insert-on-conflict-do-nothing on `matrix_event_id`.
 *
 * Returns `true` if THIS call won the insert (caller proceeds to `dispatch()`), `false` if the
 * event was already recorded (caller skips). Called *before* dispatch and committed before the
 * transaction is ACKed — so redelivery, cross-`txnId` duplicates, crash-before-ACK, and a
 * reconciler racing the live endpoint all collapse to one dispatch.
 *
 * Mirrors `tryClaimScheduledItemInvitationDispatch`
 * (`packages/core/src/schedule/server/invitation-dispatch.ts`).
 */
export async function claimProcessedEvent(
  entry: NewNotificationProcessedEvent,
  db: DatabaseInstance,
): Promise<boolean> {
  const [row] = await db
    .insert(notificationProcessedEvents)
    .values(entry)
    .onConflictDoNothing({
      target: notificationProcessedEvents.matrixEventId,
    })
    .returning();

  return Boolean(row);
}
