-- #2724: server-set origin of signals and quests. EXPAND step, additive only.
-- Adds origin_kind (NOT NULL DEFAULT 'unknown'), origin_client_id and origin_client_label. The database fills
-- existing rows with 'unknown' as part of the statement (no application backfill, nothing inferred).
-- The DEFAULT stays in this migration on purpose: code that does not pass an origin yet (the previous deploy,
-- other branches) must keep inserting. A later CONTRACT migration drops the default.
-- Rollback: ALTER TABLE <t> DROP CONSTRAINT <t>_origin_client_check, DROP CONSTRAINT <t>_origin_kind_check,
--   DROP COLUMN origin_client_label, DROP COLUMN origin_client_id, DROP COLUMN origin_kind (loses origin data only).
-- Hand-authored (repo convention: IF NOT EXISTS; drizzle-kit generate/migrate/push are not used for authoring).

ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "origin_kind" text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "origin_client_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "origin_client_label" varchar(120);
--> statement-breakpoint
ALTER TABLE "coherences" DROP CONSTRAINT IF EXISTS "coherences_origin_kind_check";
--> statement-breakpoint
ALTER TABLE "coherences" ADD CONSTRAINT "coherences_origin_kind_check" CHECK ("origin_kind" IN ('app', 'hypha_assistant', 'mcp_client', 'api_client', 'space_key', 'hypha_intelligence', 'hypha_platform', 'unknown'));
--> statement-breakpoint
ALTER TABLE "coherences" DROP CONSTRAINT IF EXISTS "coherences_origin_client_check";
--> statement-breakpoint
ALTER TABLE "coherences" ADD CONSTRAINT "coherences_origin_client_check" CHECK (("origin_kind" NOT IN ('app', 'unknown', 'hypha_assistant') OR ("origin_client_id" IS NULL AND "origin_client_label" IS NULL)) AND ("origin_kind" NOT IN ('mcp_client', 'api_client', 'space_key') OR "origin_client_id" IS NOT NULL) AND ("origin_client_id" IS NULL OR length(btrim("origin_client_id")) BETWEEN 1 AND 255) AND ("origin_client_label" IS NULL OR length(btrim("origin_client_label")) BETWEEN 1 AND 120));
--> statement-breakpoint
ALTER TABLE "space_quests" ADD COLUMN IF NOT EXISTS "origin_kind" text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "space_quests" ADD COLUMN IF NOT EXISTS "origin_client_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "space_quests" ADD COLUMN IF NOT EXISTS "origin_client_label" varchar(120);
--> statement-breakpoint
ALTER TABLE "space_quests" DROP CONSTRAINT IF EXISTS "space_quests_origin_kind_check";
--> statement-breakpoint
ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_origin_kind_check" CHECK ("origin_kind" IN ('app', 'hypha_assistant', 'mcp_client', 'api_client', 'space_key', 'hypha_intelligence', 'hypha_platform', 'unknown'));
--> statement-breakpoint
ALTER TABLE "space_quests" DROP CONSTRAINT IF EXISTS "space_quests_origin_client_check";
--> statement-breakpoint
ALTER TABLE "space_quests" ADD CONSTRAINT "space_quests_origin_client_check" CHECK (("origin_kind" NOT IN ('app', 'unknown', 'hypha_assistant') OR ("origin_client_id" IS NULL AND "origin_client_label" IS NULL)) AND ("origin_kind" NOT IN ('mcp_client', 'api_client', 'space_key') OR "origin_client_id" IS NOT NULL) AND ("origin_client_id" IS NULL OR length(btrim("origin_client_id")) BETWEEN 1 AND 255) AND ("origin_client_label" IS NULL OR length(btrim("origin_client_label")) BETWEEN 1 AND 120));
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ADD COLUMN IF NOT EXISTS "origin_kind" text NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ADD COLUMN IF NOT EXISTS "origin_client_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ADD COLUMN IF NOT EXISTS "origin_client_label" varchar(120);
--> statement-breakpoint
ALTER TABLE "space_quest_updates" DROP CONSTRAINT IF EXISTS "space_quest_updates_origin_kind_check";
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ADD CONSTRAINT "space_quest_updates_origin_kind_check" CHECK ("origin_kind" IN ('app', 'hypha_assistant', 'mcp_client', 'api_client', 'space_key', 'hypha_intelligence', 'hypha_platform', 'unknown'));
--> statement-breakpoint
ALTER TABLE "space_quest_updates" DROP CONSTRAINT IF EXISTS "space_quest_updates_origin_client_check";
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ADD CONSTRAINT "space_quest_updates_origin_client_check" CHECK (("origin_kind" NOT IN ('app', 'unknown', 'hypha_assistant') OR ("origin_client_id" IS NULL AND "origin_client_label" IS NULL)) AND ("origin_kind" NOT IN ('mcp_client', 'api_client', 'space_key') OR "origin_client_id" IS NOT NULL) AND ("origin_client_id" IS NULL OR length(btrim("origin_client_id")) BETWEEN 1 AND 255) AND ("origin_client_label" IS NULL OR length(btrim("origin_client_label")) BETWEEN 1 AND 120));
