ALTER TABLE "space_scheduled_items" ADD COLUMN "recurrence_rule" text;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD COLUMN "recurrence_until" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD COLUMN "matrix_room_id" text;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD COLUMN "matrix_auto_link" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD COLUMN "reminder_minutes_before" integer;
--> statement-breakpoint
CREATE INDEX "space_scheduled_items_reminder_due_idx" ON "space_scheduled_items" USING btree ("reminder_minutes_before","starts_at") WHERE "reminder_minutes_before" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "space_scheduled_item_reminder_dispatches" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduled_item_id" integer NOT NULL,
	"occurrence_starts_at" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"dispatched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_scheduled_item_reminder_dispatches" ADD CONSTRAINT "space_scheduled_item_reminder_dispatches_scheduled_item_id_space_scheduled_items_id_fk" FOREIGN KEY ("scheduled_item_id") REFERENCES "public"."space_scheduled_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "space_scheduled_item_reminder_unique" ON "space_scheduled_item_reminder_dispatches" USING btree ("scheduled_item_id","occurrence_starts_at","channel");
--> statement-breakpoint
CREATE INDEX "space_scheduled_item_reminder_item_idx" ON "space_scheduled_item_reminder_dispatches" USING btree ("scheduled_item_id");
