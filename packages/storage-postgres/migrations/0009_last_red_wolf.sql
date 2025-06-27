ALTER TABLE "people" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "surname" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "nickname" text;