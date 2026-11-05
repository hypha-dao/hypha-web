CREATE UNIQUE INDEX IF NOT EXISTS "space_context_sections_space_title_unique" ON "space_context_sections" USING btree ("space_id",lower("title")) WHERE "space_context_sections"."title" is not null;
