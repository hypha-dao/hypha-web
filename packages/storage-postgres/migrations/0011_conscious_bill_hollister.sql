ALTER TABLE "people" ADD COLUMN "sub" text;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_sub_unique" UNIQUE("sub");