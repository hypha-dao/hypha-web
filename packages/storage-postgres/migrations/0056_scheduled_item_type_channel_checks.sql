ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_type_check" CHECK ("type" IN ('call', 'event', 'meeting', 'deadline', 'reminder'));--> statement-breakpoint
ALTER TABLE "space_scheduled_item_reminder_dispatches" ADD CONSTRAINT "space_scheduled_item_reminder_channel_check" CHECK ("channel" IN ('email', 'push'));
