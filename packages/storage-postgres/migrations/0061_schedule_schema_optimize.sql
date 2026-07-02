-- Idempotent cleanup for preview DBs that ran pre-optimization 0055/0059.
ALTER TABLE "space_scheduled_items" DROP COLUMN IF EXISTS "remind_email";
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" DROP COLUMN IF EXISTS "remind_push";
--> statement-breakpoint
DROP INDEX IF EXISTS "space_scheduled_items_reminder_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_scheduled_items_reminder_due_idx" ON "space_scheduled_items" USING btree ("reminder_minutes_before","starts_at") WHERE "reminder_minutes_before" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "coherences_due_at_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coherences_space_due_at_idx" ON "coherences" ("space_id", "due_at")
  WHERE "due_at" IS NOT NULL AND "archived" = false;
--> statement-breakpoint
DROP INDEX IF EXISTS "space_scheduled_items_coherence_id_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_scheduled_items_space_coherence_idx" ON "space_scheduled_items" ("space_id", "coherence_id")
  WHERE "coherence_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coherences_id_space_id_key" ON "coherences" ("id", "space_id");
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" DROP CONSTRAINT IF EXISTS "space_scheduled_items_coherence_id_coherences_id_fk";
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" DROP CONSTRAINT IF EXISTS "space_scheduled_items_coherence_space_fk";
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_coherence_space_fk"
  FOREIGN KEY ("coherence_id", "space_id") REFERENCES "coherences"("id", "space_id")
  ON DELETE set null ON UPDATE no action NOT VALID;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" VALIDATE CONSTRAINT "space_scheduled_items_coherence_space_fk";
