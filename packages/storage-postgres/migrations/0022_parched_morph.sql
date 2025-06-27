ALTER TABLE "documents" ALTER COLUMN "state" SET DEFAULT 'agreement';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "lead_image" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb;