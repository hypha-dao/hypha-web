-- #2515 M2: registry of external integration clients (B2B apps acting on behalf of consenting users).
--
-- Separate from space_api_keys (space-scoped signal credentials). Only the SHA-256 digest of the key is
-- stored; the plaintext is shown once at approval. No RLS read policy: rows are never member-facing.
-- Hand-authored (repo convention; drizzle-kit generate/migrate are not used for new migrations).
CREATE TABLE IF NOT EXISTS "integration_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(64) NOT NULL,
	"contact_email" text NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_prefix" varchar(16),
	"key_hash" text,
	"requested_by_person_id" integer REFERENCES "people"("id") ON DELETE set null,
	"approved_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_clients_slug_unique" ON "integration_clients" USING btree ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_clients_key_hash_unique" ON "integration_clients" USING btree ("key_hash") WHERE "integration_clients"."key_hash" IS NOT NULL;
