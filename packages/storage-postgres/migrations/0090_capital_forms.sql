ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "capitals" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "capital" text;
