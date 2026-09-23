import { lt } from 'drizzle-orm';
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

/**
 * Deletes ledger rows older than `olderThanMs`. The schema docstring promises this table is
 * "pruned on a schedule by the reconcile cron" — `reconcileMatrixNotifications` calls this once
 * per run. `olderThanMs` must stay comfortably larger than the reconciler's own scan window, or a
 * row could be pruned while still inside that window and get re-claimed (and re-notified) on the
 * next run.
 */
export async function pruneProcessedEvents(
  olderThanMs: number,
  db: DatabaseInstance,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const deleted = await db
    .delete(notificationProcessedEvents)
    .where(lt(notificationProcessedEvents.dispatchedAt, cutoff))
    .returning();
  return deleted.length;
}
