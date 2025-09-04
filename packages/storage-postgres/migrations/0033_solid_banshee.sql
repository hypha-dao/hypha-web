ALTER TABLE "spaces" ADD COLUMN "flags" jsonb DEFAULT '[]'::jsonb NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spaces_flags_gin ON public.spaces USING GIN (flags);

UPDATE "spaces"
SET
  "flags" = (
    -- Start with existing flags
    "flags"
    -- Add sandbox if condition matches
    || CASE WHEN "categories" @> '[{"key": "sandbox"}]' OR "categories" @> '"sandbox"'
           THEN '"sandbox"'::jsonb ELSE '[]'::jsonb END
    -- Add demo if condition matches  
    || CASE WHEN "categories" @> '[{"key": "usecase"}]' OR "categories" @> '"usecase"'
           THEN '"demo"'::jsonb ELSE '[]'::jsonb END
  ),
  "categories" = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements("categories") elem
    WHERE NOT (
      (elem @> '{"key": "sandbox"}'::JSONB) OR
      (elem @> '{"key": "usecase"}'::JSONB) OR
      (elem = '"sandbox"'::JSONB) OR
      (elem = '"usecase"'::JSONB)
    )
  )
WHERE
  "categories" @> '[{"key": "sandbox"}]' OR "categories" @> '"sandbox"' OR
  "categories" @> '[{"key": "usecase"}]' OR "categories" @> '"usecase"';
