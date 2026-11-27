-- Per-space screen order and which screens are hidden.
-- `{}` keeps the default order. Showing Pipeline is still `pipeline_enabled`.
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "screen_layout" jsonb DEFAULT '{}'::jsonb NOT NULL;
