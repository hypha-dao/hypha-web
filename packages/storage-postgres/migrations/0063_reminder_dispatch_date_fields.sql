ALTER TABLE "space_scheduled_item_reminder_dispatches" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "space_scheduled_item_reminder_dispatches" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
