CREATE TABLE IF NOT EXISTS "space_scheduled_item_invitation_dispatches" (
  "id" serial PRIMARY KEY NOT NULL,
  "scheduled_item_id" integer NOT NULL,
  "invite_revision" text NOT NULL,
  "channel" text NOT NULL,
  "dispatched_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "space_scheduled_item_invitation_dispatches_scheduled_item_id_space_scheduled_items_id_fk"
    FOREIGN KEY ("scheduled_item_id") REFERENCES "public"."space_scheduled_items"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_scheduled_item_invitation_unique"
  ON "space_scheduled_item_invitation_dispatches" USING btree ("scheduled_item_id","invite_revision","channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_scheduled_item_invitation_item_idx"
  ON "space_scheduled_item_invitation_dispatches" USING btree ("scheduled_item_id");
