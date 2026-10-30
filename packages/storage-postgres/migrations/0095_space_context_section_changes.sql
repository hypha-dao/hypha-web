ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "pending_change" text;--> statement-breakpoint
ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
