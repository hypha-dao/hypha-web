CREATE TABLE IF NOT EXISTS "space_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"name" text NOT NULL,
	"source" varchar(64) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_person_id" integer,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'space_api_keys_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "space_api_keys" ADD CONSTRAINT "space_api_keys_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'space_api_keys_created_by_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "space_api_keys" ADD CONSTRAINT "space_api_keys_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_api_keys_key_hash_unique" ON "space_api_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_api_keys_space_source_unique" ON "space_api_keys" USING btree ("space_id","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_api_keys_space_revoked_idx" ON "space_api_keys" USING btree ("space_id","revoked_at");
--> statement-breakpoint
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coherences_space_source_external_id_unique" ON "coherences" USING btree ("space_id","source","external_id")
  WHERE "space_id" IS NOT NULL AND "source" IS NOT NULL AND "external_id" IS NOT NULL;
