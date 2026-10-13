ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "assignee_acknowledged_at" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "deadline_notify_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
