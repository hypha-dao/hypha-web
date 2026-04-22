ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
