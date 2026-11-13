ALTER TABLE "coherence_upvotes" ADD COLUMN IF NOT EXISTS "direction" text DEFAULT 'up' NOT NULL;
--> statement-breakpoint
ALTER TABLE "coherence_upvotes" DROP CONSTRAINT IF EXISTS "coherence_upvotes_direction_check";
--> statement-breakpoint
ALTER TABLE "coherence_upvotes" ADD CONSTRAINT "coherence_upvotes_direction_check" CHECK ("direction" IN ('up', 'down'));
