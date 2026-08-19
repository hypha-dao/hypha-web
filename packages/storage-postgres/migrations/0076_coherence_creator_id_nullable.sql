-- Catalog-only change, safe on large tables. Not symmetric to roll back: once system-triggered
-- signals write creator_id = NULL, restoring NOT NULL requires backfilling or deleting those rows
-- first — do not reapply NOT NULL blindly.
ALTER TABLE "coherences" ALTER COLUMN "creator_id" DROP NOT NULL;
