-- Preview databases that applied the quest-domain migration under the old
-- 0107 timestamp never ran 0107_space_screen_layout. Drizzle skips any
-- migration whose timestamp is not newer than the last applied one, so the
-- screen_layout column was missing and every space query crashed.
-- Main already has the column from 0107. This is a no-op there.
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "screen_layout" jsonb DEFAULT '{}'::jsonb NOT NULL;
