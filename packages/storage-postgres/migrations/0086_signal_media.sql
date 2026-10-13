ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "lead_image" text;
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "video_url" text;
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
