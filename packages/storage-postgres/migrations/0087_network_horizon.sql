ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "network_horizon" text DEFAULT 'spaces' NOT NULL;
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "shared_with_network" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "coherences_shared_with_network_idx" ON "coherences" ("updated_at") WHERE "shared_with_network" = true;
