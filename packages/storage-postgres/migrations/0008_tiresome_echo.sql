ALTER TABLE "people" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_slug_unique" UNIQUE("slug");

CREATE OR REPLACE FUNCTION generate_people_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(replace(NEW.name, ' ', '-'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_people
BEFORE INSERT ON people
FOR EACH ROW
EXECUTE FUNCTION generate_people_slug();

CREATE TRIGGER before_update_people
BEFORE UPDATE ON people
FOR EACH ROW
EXECUTE FUNCTION generate_people_slug();

-- Update existing records that don't have a slug
UPDATE people
SET slug = lower(replace(name, ' ', '-'))
WHERE slug IS NULL;
