ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "pipeline_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"pipeline_swimlane" text NOT NULL,
	"pipeline_status" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT '€' NOT NULL,
	"country" text,
	"region" text DEFAULT 'Global' NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contact_person" text,
	"contact_email" text,
	"linkedin_url" text,
	"contact_url" text,
	"team_member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"account_manager_id" integer,
	"next_action" text,
	"next_action_date" date,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"blocker_reason" text,
	"submission_deadline" date,
	"funding_rate_sme" numeric(8, 2),
	"max_project_size" numeric(18, 2),
	"expected_partners" text,
	"is_consortium_lead" boolean,
	"eligible_countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"call_reference" text,
	"programme" text,
	"eligibility_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_saved_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"country_focus" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_owner_id_people_id_fk'
  ) THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_account_manager_id_people_id_fk'
  ) THEN
    ALTER TABLE "deals" ADD CONSTRAINT "deals_account_manager_id_people_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_saved_views_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "pipeline_saved_views" ADD CONSTRAINT "pipeline_saved_views_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_saved_views_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "pipeline_saved_views" ADD CONSTRAINT "pipeline_saved_views_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_user_settings_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "pipeline_user_settings" ADD CONSTRAINT "pipeline_user_settings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_user_settings_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "pipeline_user_settings" ADD CONSTRAINT "pipeline_user_settings_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_space_id_idx" ON "deals" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_space_swimlane_idx" ON "deals" USING btree ("space_id","pipeline_swimlane");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deals_space_status_idx" ON "deals" USING btree ("space_id","pipeline_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_saved_views_space_person_idx" ON "pipeline_saved_views" USING btree ("space_id","person_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_saved_views_space_person_name_uidx" ON "pipeline_saved_views" USING btree ("space_id","person_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_user_settings_space_person_uidx" ON "pipeline_user_settings" USING btree ("space_id","person_id");
