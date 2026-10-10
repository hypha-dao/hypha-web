ALTER TABLE "coherences" ADD COLUMN "assignee_acknowledged_at" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "coherences" ADD COLUMN "deadline_notify_state" jsonb DEFAULT '{}'::jsonb NOT NULL;
