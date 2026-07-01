UPDATE "space_scheduled_items"
SET "type" = 'event'
WHERE "type" IN ('deadline', 'reminder');
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" DROP CONSTRAINT IF EXISTS "space_scheduled_items_type_check";
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_type_check" CHECK ("type" IN ('call', 'event', 'meeting', 'booking'));
