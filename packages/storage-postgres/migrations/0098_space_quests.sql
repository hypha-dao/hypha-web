CREATE TABLE IF NOT EXISTS "space_quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"scope_in" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_out" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_in_markdown" text DEFAULT '' NOT NULL,
	"scope_out_markdown" text DEFAULT '' NOT NULL,
	"success_criteria" text DEFAULT '' NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"target_date" text,
	"lead_person_id" integer,
	"lead_name" text,
	"creator_person_id" integer,
	"proposal_document_id" integer,
	"accepted_at" timestamp,
	"chat_room_id" text,
	"health_state" text DEFAULT 'on_track' NOT NULL,
	"health_marker" integer DEFAULT 80 NOT NULL,
	"health_summary" text DEFAULT '' NOT NULL,
	"health_updated_at" timestamp,
	"steward_health_summaries" boolean DEFAULT true NOT NULL,
	"member_update_alerts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_quest_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"due_date" text,
	"owner_person_id" integer,
	"owner_name" text,
	"status" text DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_quest_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"person_id" integer,
	"member_name" text NOT NULL,
	"member_avatar_url" text,
	"role_label" text,
	"responsibilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_quest_deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"note" text,
	"order" integer DEFAULT 1 NOT NULL,
	"updated_by_person_id" integer,
	"updated_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "space_quest_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"author_person_id" integer,
	"author_name" text NOT NULL,
	"author_avatar_url" text,
	"kind" text DEFAULT 'post' NOT NULL,
	"via_agent" boolean DEFAULT false NOT NULL,
	"milestone_order" integer,
	"milestone_label" text,
	"text" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_lead_person_id_people_id_fk" FOREIGN KEY ("lead_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_creator_person_id_people_id_fk" FOREIGN KEY ("creator_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_proposal_document_id_documents_id_fk" FOREIGN KEY ("proposal_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_milestones" ADD CONSTRAINT "space_quest_milestones_quest_id_space_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."space_quests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_milestones" ADD CONSTRAINT "space_quest_milestones_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_members" ADD CONSTRAINT "space_quest_members_quest_id_space_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."space_quests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_members" ADD CONSTRAINT "space_quest_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_deliverables" ADD CONSTRAINT "space_quest_deliverables_quest_id_space_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."space_quests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_deliverables" ADD CONSTRAINT "space_quest_deliverables_updated_by_person_id_people_id_fk" FOREIGN KEY ("updated_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_updates" ADD CONSTRAINT "space_quest_updates_quest_id_space_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."space_quests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "space_quest_updates" ADD CONSTRAINT "space_quest_updates_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_quests_space_slug_unique" ON "space_quests" USING btree ("space_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quests_space_id_idx" ON "space_quests" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quests_proposal_document_id_idx" ON "space_quests" USING btree ("proposal_document_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quest_milestones_quest_id_idx" ON "space_quest_milestones" USING btree ("quest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quest_members_quest_id_idx" ON "space_quest_members" USING btree ("quest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quest_deliverables_quest_id_idx" ON "space_quest_deliverables" USING btree ("quest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_quest_updates_quest_id_idx" ON "space_quest_updates" USING btree ("quest_id");
