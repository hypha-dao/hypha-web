-- First migration: Add the column
ALTER TABLE "spaces" ADD COLUMN "parent_id" integer;

-- Second migration (your existing one): Add the foreign key constraint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_parent_id_spaces_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;