-- Create the table when 0092 was skipped because its timestamp was already recorded.
CREATE TABLE IF NOT EXISTS "space_context_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"section_key" text NOT NULL,
	"markdown" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"proposal_document_id" integer,
	"ratified_document_id" integer,
	"ratified_at" timestamp,
	"updated_by_person_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "pending_change" text;
--> statement-breakpoint
ALTER TABLE "space_context_sections" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;
