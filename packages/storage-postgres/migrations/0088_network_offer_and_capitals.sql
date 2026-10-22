ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "network_offer" text;
--> statement-breakpoint
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "exchange_capitals" jsonb;
