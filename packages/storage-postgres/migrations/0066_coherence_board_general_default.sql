-- Uncategorized signals default to the General board category.
UPDATE "coherences"
SET "board" = 'general'
WHERE "board" IS NULL;
