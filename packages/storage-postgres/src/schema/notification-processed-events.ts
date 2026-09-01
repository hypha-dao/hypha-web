import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

/**
 * Idempotency ledger for the inbound Matrix Application Service transaction receiver (#2483).
 *
 * One row per Matrix event the receiver has durably accepted. The receiver inserts here with
 * `onConflictDoNothing` on `matrixEventId` *before* handing the event to the notification
 * `dispatch()` layer, and only ACKs the AS transaction (HTTP 200) once the row is committed —
 * so a redelivered transaction (same `txnId`), the same event arriving under a different
 * `txnId`, a crash between the write and the ACK, or a bounded reconciler racing the live
 * endpoint all collapse to a single dispatch.
 *
 * Dedupe key is `matrixEventId` alone (decided in #2470 D4 / #2483 spec). No FKs — Matrix event
 * and room ids are not our keys. Holds only identifiers, never message content; pruned on a
 * schedule by the reconcile cron.
 */
export const notificationProcessedEvents = pgTable(
  'notification_processed_events',
  {
    matrixEventId: text('matrix_event_id').primaryKey(),
    roomId: text('room_id').notNull(),
    eventType: text('event_type').notNull(),
    /** Last `txnId` this event was seen under. Audit/fast-path only — not the dedupe guard. */
    txnId: text('txn_id'),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('notification_processed_events_room_id_idx').on(table.roomId),
    index('notification_processed_events_dispatched_at_idx').on(
      table.dispatchedAt,
    ),
  ],
);

export type NotificationProcessedEvent = InferSelectModel<
  typeof notificationProcessedEvents
>;
export type NewNotificationProcessedEvent = InferInsertModel<
  typeof notificationProcessedEvents
>;
