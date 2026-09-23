-- Adds `commonDateFields` (created_at/updated_at) to notification_processed_events, per repo
-- convention (see .cursor/rules/db-migrations.mdc). A separate migration rather than editing
-- 0078 in place, since 0078 may already be applied on some environments' DBs by the time this
-- lands. Hand-authored (repo convention since ~0054 ships without per-migration meta snapshots).
ALTER TABLE "notification_processed_events" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_processed_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
