-- #2515 approval-flow spike: an operation an integration client asked for on behalf of a person,
-- waiting for that person's approval on a Hypha page. Bound to one client and one person, single
-- use, short expiry. No RLS read policy: rows are read through authenticated API routes only.
-- Hand-authored (repo convention; drizzle-kit generate/migrate/push are not used for new migrations).
CREATE TABLE IF NOT EXISTS "integration_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" integer NOT NULL REFERENCES "integration_clients"("id") ON DELETE cascade,
	"person_id" integer NOT NULL REFERENCES "people"("id") ON DELETE cascade,
	"operation" varchar(32) NOT NULL,
	"parameters" jsonb NOT NULL,
	"context" jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"tx_hash" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_actions_client_person_idx" ON "integration_actions" USING btree ("client_id","person_id");
