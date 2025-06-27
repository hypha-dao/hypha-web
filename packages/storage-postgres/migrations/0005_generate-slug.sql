-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE FUNCTION generate_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(replace(NEW.title, ' ', '-'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_documents
BEFORE INSERT ON documents
FOR EACH ROW
EXECUTE FUNCTION generate_slug();

CREATE TRIGGER before_update_documents
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION generate_slug();
