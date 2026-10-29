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
CREATE TABLE IF NOT EXISTS "space_context_section_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"person_id" integer,
	"agent_key" text,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_context_agent_memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"section_key" text NOT NULL,
	"agent_key" text NOT NULL,
	"memory_markdown" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_sections" ADD CONSTRAINT "space_context_sections_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_sections" ADD CONSTRAINT "space_context_sections_proposal_document_id_documents_id_fk" FOREIGN KEY ("proposal_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_sections" ADD CONSTRAINT "space_context_sections_ratified_document_id_documents_id_fk" FOREIGN KEY ("ratified_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_sections" ADD CONSTRAINT "space_context_sections_updated_by_person_id_people_id_fk" FOREIGN KEY ("updated_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_section_messages" ADD CONSTRAINT "space_context_section_messages_section_id_space_context_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."space_context_sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_section_messages" ADD CONSTRAINT "space_context_section_messages_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_context_agent_memories" ADD CONSTRAINT "space_context_agent_memories_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_context_sections_space_key_unique" ON "space_context_sections" USING btree ("space_id","section_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_context_sections_space_id_idx" ON "space_context_sections" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_context_sections_proposal_document_id_idx" ON "space_context_sections" USING btree ("proposal_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_context_section_messages_section_id_idx" ON "space_context_section_messages" USING btree ("section_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_context_agent_memories_unique" ON "space_context_agent_memories" USING btree ("space_id","section_key","agent_key");
