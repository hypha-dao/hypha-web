ALTER TABLE "spaces"
ADD COLUMN "ecosystem_logo_url_light" text,
ADD COLUMN "ecosystem_logo_url_dark" text;

UPDATE "spaces"
SET
  "ecosystem_logo_url_light" = "ecosystem_logo_url",
  "ecosystem_logo_url_dark" = "ecosystem_logo_url"
WHERE "ecosystem_logo_url" IS NOT NULL;
