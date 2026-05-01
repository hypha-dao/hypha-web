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

-- Defer dropping "ecosystem_logo_url" to a later migration after rollout confirmation.
