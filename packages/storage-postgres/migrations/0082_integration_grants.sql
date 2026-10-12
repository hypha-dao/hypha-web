-- #2515 M3a: a person's trust in an integration client for a set of scopes.
--
-- Hypha's own authorization record; the wallet signer is a separate capability checked at signing
-- time (D17). One active grant per (client, person); revoked rows are kept as history. No RLS read
-- policy: grants are read through authenticated API routes only.
-- Hand-authored (repo convention; drizzle-kit generate/migrate/push are not used for new migrations).
CREATE TABLE IF NOT EXISTS "integration_grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL REFERENCES "integration_clients"("id") ON DELETE cascade,
	"person_id" integer NOT NULL REFERENCES "people"("id") ON DELETE cascade,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_grants_active_unique" ON "integration_grants" USING btree ("client_id","person_id") WHERE "integration_grants"."status" = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_grants_person_idx" ON "integration_grants" USING btree ("person_id");
