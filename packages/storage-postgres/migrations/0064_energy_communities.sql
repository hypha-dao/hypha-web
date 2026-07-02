-- Idempotent: preview and other DBs may already have this table from the
-- historical 0048_energy_communities migration before it was renumbered to 0049.
CREATE TABLE IF NOT EXISTS "energy_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"chain_id" integer DEFAULT 8453 NOT NULL,
	"community_proxy_address" text NOT NULL,
	"energy_token_address" text NOT NULL,
	"admin_address" text NOT NULL,
	"factory_community_id" bigint,
	"activated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'energy_communities_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "energy_communities" ADD CONSTRAINT "energy_communities_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "energy_communities_space_id_uidx" ON "energy_communities" USING btree ("space_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "energy_communities_proxy_uidx" ON "energy_communities" USING btree ("community_proxy_address");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "energy_communities_admin_idx" ON "energy_communities" USING btree ("admin_address");
