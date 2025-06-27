ALTER TABLE "documents" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "space_configs" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "space_configs" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "updated_at" SET NOT NULL;