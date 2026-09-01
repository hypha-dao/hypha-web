-- #2483: idempotency ledger for the inbound Matrix Application Service transaction receiver.
--
-- One row per Matrix event the receiver has durably accepted. The receiver inserts here
-- (ON CONFLICT DO NOTHING on matrix_event_id) BEFORE handing the event to the notification
-- dispatch layer, and only ACKs the AS transaction once this row is committed — so redelivered
-- transactions, cross-txn duplicates, crash-before-ACK, and reconciler/live races all collapse
-- to a single dispatch. Holds identifiers only (no message content); pruned on a schedule by the
-- reconcile cron. Hand-authored (repo convention since ~0054 ships without per-migration meta
-- snapshots); run `pnpm --filter @hypha-platform/storage-postgres run generate` against a live
-- DB to reconcile the drizzle snapshot when one is available.
CREATE TABLE IF NOT EXISTS "notification_processed_events" (
	"matrix_event_id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"event_type" text NOT NULL,
	"txn_id" text,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_processed_events_room_id_idx" ON "notification_processed_events" USING btree ("room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_processed_events_dispatched_at_idx" ON "notification_processed_events" USING btree ("dispatched_at");
