CREATE TABLE IF NOT EXISTS "space_quest_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"author_person_id" integer NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_drafts" ADD CONSTRAINT "space_quest_drafts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_drafts" ADD CONSTRAINT "space_quest_drafts_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quest_drafts_space_author_idx" ON "space_quest_drafts" USING btree ("space_id","author_person_id");
