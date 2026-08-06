DO $$ BEGIN
  CREATE TYPE "public"."campaign_project_group" AS ENUM('initiative', 'program', 'enabling');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."campaign_cycle_status" AS ENUM('open', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."campaign_grant_kind" AS ENUM('join', 'contribution', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."campaign_mint_status" AS ENUM('pending', 'sent', 'confirmed', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."campaign_payment_status" AS ENUM('pending', 'settled', 'refunded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"program" text DEFAULT '' NOT NULL,
	"group" "campaign_project_group" DEFAULT 'initiative' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"team" text DEFAULT '' NOT NULL,
	"video_url" text,
	"image_url" text,
	"payout_address" text,
	"payout_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"status" "campaign_cycle_status" DEFAULT 'open' NOT NULL,
	"starts_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"duration_days" integer DEFAULT 21 NOT NULL,
	"match_multiplier" numeric(6, 3) DEFAULT '1' NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_cycles_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"cycle_id" integer,
	"kind" "campaign_grant_kind" NOT NULL,
	"idempotency_key" text NOT NULL,
	"rsut" numeric(20, 6) NOT NULL,
	"aud_cents" integer DEFAULT 0 NOT NULL,
	"payment_provider" text,
	"payment_reference" text,
	"payment_status" "campaign_payment_status" DEFAULT 'settled' NOT NULL,
	"mint_status" "campaign_mint_status" DEFAULT 'pending' NOT NULL,
	"mint_tx_hash" text,
	"mint_attempts" integer DEFAULT 0 NOT NULL,
	"mint_error" text,
	"mint_to_address" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_grants_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"weight" numeric(20, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"votes" numeric(20, 6) DEFAULT '0' NOT NULL,
	"share" numeric(10, 8) DEFAULT '0' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"paid_at" timestamp,
	"paid_reference" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_grants_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "campaign_grants" ADD CONSTRAINT "campaign_grants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_grants_cycle_id_campaign_cycles_id_fk'
  ) THEN
    ALTER TABLE "campaign_grants" ADD CONSTRAINT "campaign_grants_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_votes_cycle_id_campaign_cycles_id_fk'
  ) THEN
    ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_votes_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_votes_project_id_campaign_projects_id_fk'
  ) THEN
    ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_project_id_campaign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."campaign_projects"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_payouts_cycle_id_campaign_cycles_id_fk'
  ) THEN
    ALTER TABLE "campaign_payouts" ADD CONSTRAINT "campaign_payouts_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_payouts_project_id_campaign_projects_id_fk'
  ) THEN
    ALTER TABLE "campaign_payouts" ADD CONSTRAINT "campaign_payouts_project_id_campaign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."campaign_projects"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_projects_active_idx" ON "campaign_projects" USING btree ("active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_cycles_status_idx" ON "campaign_cycles" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_grants_person_idx" ON "campaign_grants" USING btree ("person_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_grants_mint_status_idx" ON "campaign_grants" USING btree ("mint_status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_grants_payment_ref_idx" ON "campaign_grants" USING btree ("payment_provider","payment_reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_votes_unique_idx" ON "campaign_votes" USING btree ("cycle_id","person_id","project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_votes_cycle_project_idx" ON "campaign_votes" USING btree ("cycle_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_payouts_unique_idx" ON "campaign_payouts" USING btree ("cycle_id","project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_cycles_single_open_idx" ON "campaign_cycles" USING btree ("status") WHERE "status" = 'open';
