CREATE TYPE "public"."campaign_cycle_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."campaign_grant_kind" AS ENUM('join', 'contribution', 'manual');--> statement-breakpoint
CREATE TYPE "public"."campaign_mint_status" AS ENUM('pending', 'sent', 'confirmed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."campaign_payment_status" AS ENUM('pending', 'settled', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."campaign_project_group" AS ENUM('initiative', 'program', 'enabling');--> statement-breakpoint
CREATE TABLE "campaign_cycles" (
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
CREATE TABLE "campaign_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
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
CREATE TABLE "campaign_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"sub" text NOT NULL,
	"email" text,
	"name" text,
	"wallet_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_members_sub_unique" UNIQUE("sub")
);
--> statement-breakpoint
CREATE TABLE "campaign_payouts" (
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
CREATE TABLE "campaign_projects" (
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
CREATE TABLE "campaign_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"weight" numeric(20, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_grants" ADD CONSTRAINT "campaign_grants_member_id_campaign_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."campaign_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_grants" ADD CONSTRAINT "campaign_grants_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_payouts" ADD CONSTRAINT "campaign_payouts_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_payouts" ADD CONSTRAINT "campaign_payouts_project_id_campaign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."campaign_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_cycle_id_campaign_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."campaign_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_member_id_campaign_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."campaign_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_votes" ADD CONSTRAINT "campaign_votes_project_id_campaign_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."campaign_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_cycles_status_idx" ON "campaign_cycles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_cycles_single_open_idx" ON "campaign_cycles" USING btree ("status") WHERE "campaign_cycles"."status" = 'open';--> statement-breakpoint
CREATE INDEX "campaign_grants_member_idx" ON "campaign_grants" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "campaign_grants_mint_status_idx" ON "campaign_grants" USING btree ("mint_status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_grants_payment_ref_idx" ON "campaign_grants" USING btree ("payment_provider","payment_reference");--> statement-breakpoint
CREATE INDEX "campaign_members_email_idx" ON "campaign_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "campaign_members_wallet_idx" ON "campaign_members" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_payouts_unique_idx" ON "campaign_payouts" USING btree ("cycle_id","project_id");--> statement-breakpoint
CREATE INDEX "campaign_projects_active_idx" ON "campaign_projects" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_votes_unique_idx" ON "campaign_votes" USING btree ("cycle_id","member_id","project_id");--> statement-breakpoint
CREATE INDEX "campaign_votes_cycle_project_idx" ON "campaign_votes" USING btree ("cycle_id","project_id");