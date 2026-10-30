ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "ratified_markdown" text;--> statement-breakpoint
UPDATE "space_context_sections" SET "ratified_markdown" = "markdown" WHERE "status" = 'ratified' AND "ratified_markdown" IS NULL;
