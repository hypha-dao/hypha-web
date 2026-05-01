DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spaces'
      AND column_name = 'ecosystem_logo_url'
  ) THEN
    UPDATE "spaces"
    SET
      "ecosystem_logo_url_light" = COALESCE(
        "ecosystem_logo_url_light",
        "ecosystem_logo_url"
      ),
      "ecosystem_logo_url_dark" = COALESCE(
        "ecosystem_logo_url_dark",
        "ecosystem_logo_url"
      )
    WHERE "ecosystem_logo_url" IS NOT NULL;
  END IF;
END $$;

-- Defer dropping "ecosystem_logo_url" to a later migration after rollout confirmation.
