ALTER TABLE "spaces" ALTER COLUMN "description" SET DEFAULT 'SHOULD NOT BE EMPTY';--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "description" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "links" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "categories" SET NOT NULL;