CREATE TABLE IF NOT EXISTS "space_highlight_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"summary" text,
	"cover_image_url" text,
	"goal_amount" numeric,
	"goal_currency" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"support_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'space_highlight_profiles_space_id_spaces_id_fk'
  ) THEN
    ALTER TABLE "space_highlight_profiles" ADD CONSTRAINT "space_highlight_profiles_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_highlight_profiles_space_id_uidx" ON "space_highlight_profiles" USING btree ("space_id");
