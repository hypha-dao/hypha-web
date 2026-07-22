ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "pipeline_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
