ALTER TABLE "spaces" DROP CONSTRAINT "spaces_parent_id_spaces_id_fk";
--> statement-breakpoint
ALTER TABLE "spaces" DROP COLUMN "parent_id";