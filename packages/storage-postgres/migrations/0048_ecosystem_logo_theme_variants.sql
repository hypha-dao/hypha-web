ALTER TABLE "spaces"
ADD COLUMN IF NOT EXISTS "ecosystem_logo_url_light" text,
ADD COLUMN IF NOT EXISTS "ecosystem_logo_url_dark" text;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spaces'
      AND column_name = 'ecosystem_logo_url'
  ) THEN
    EXECUTE '
      UPDATE spaces
      SET
        ecosystem_logo_url_light = COALESCE(ecosystem_logo_url_light, ecosystem_logo_url),
        ecosystem_logo_url_dark = COALESCE(ecosystem_logo_url_dark, ecosystem_logo_url)
      WHERE ecosystem_logo_url IS NOT NULL
        AND (
          ecosystem_logo_url_light IS NULL
          OR ecosystem_logo_url_dark IS NULL
        )
    ';
  END IF;
END $$;
