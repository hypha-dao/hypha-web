ALTER TABLE "coherences" ADD COLUMN "due_at" timestamp with time zone;
ALTER TABLE "coherences" ADD COLUMN "progress_status" text;
ALTER TABLE "coherences" ADD COLUMN "board" text;
ALTER TABLE "coherences" ADD COLUMN "assignee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "spaces" ADD COLUMN "signal_workflow" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "space_scheduled_items" ADD COLUMN "coherence_id" integer;

CREATE UNIQUE INDEX "coherences_id_space_id_key" ON "coherences" ("id", "space_id");

ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_coherence_space_fk"
  FOREIGN KEY ("coherence_id", "space_id") REFERENCES "coherences"("id", "space_id")
  ON DELETE set null ON UPDATE no action NOT VALID;
ALTER TABLE "space_scheduled_items" VALIDATE CONSTRAINT "space_scheduled_items_coherence_space_fk";

CREATE INDEX "coherences_space_progress_status_idx" ON "coherences" ("space_id", "progress_status");
CREATE INDEX "coherences_space_board_idx" ON "coherences" ("space_id", "board");
CREATE INDEX "coherences_space_due_at_idx" ON "coherences" ("space_id", "due_at")
  WHERE "due_at" IS NOT NULL AND "archived" = false;
CREATE INDEX "coherences_assignee_ids_idx" ON "coherences" USING gin ("assignee_ids");
CREATE INDEX "space_scheduled_items_space_coherence_idx" ON "space_scheduled_items" ("space_id", "coherence_id")
  WHERE "coherence_id" IS NOT NULL;
