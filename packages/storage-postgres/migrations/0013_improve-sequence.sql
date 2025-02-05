-- Function to reset sequence to max id + 1
CREATE OR REPLACE FUNCTION reset_sequence(table_name text, sequence_name text)
RETURNS void AS $$
DECLARE
  max_id integer;
BEGIN
  EXECUTE format('SELECT COALESCE(MAX(id), 0) + 1 FROM %I', table_name) INTO max_id;
  EXECUTE format('ALTER SEQUENCE %I RESTART WITH %s', sequence_name, max_id);
END;
$$ LANGUAGE plpgsql;

-- Add unique constraint for document slugs if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_slug_unique'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_slug_unique UNIQUE(slug);
  END IF;
END $$;

-- Create a function to generate document slugs
CREATE OR REPLACE FUNCTION generate_document_slug()
RETURNS trigger AS $$
DECLARE
  base_slug text;
  new_slug text;
  counter integer := 1;
BEGIN
  -- Generate base slug from title
  base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);

  -- Try the base slug first
  new_slug := base_slug;

  -- If slug exists, append a number until we find a unique one
  WHILE EXISTS(SELECT 1 FROM documents WHERE slug = new_slug AND id != NEW.id) LOOP
    counter := counter + 1;
    new_slug := base_slug || '-' || counter::text;
  END LOOP;

  NEW.slug := new_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for document slug generation
DROP TRIGGER IF EXISTS before_insert_documents ON documents;
CREATE TRIGGER before_insert_documents
  BEFORE INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.slug IS NULL)
  EXECUTE FUNCTION generate_document_slug();

DROP TRIGGER IF EXISTS before_update_documents ON documents;
CREATE TRIGGER before_update_documents
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (NEW.title != OLD.title AND NEW.slug = OLD.slug)
  EXECUTE FUNCTION generate_document_slug();

-- Create trigger to reset sequences after truncate
CREATE OR REPLACE FUNCTION reset_sequences_after_truncate()
RETURNS trigger AS $$
BEGIN
  PERFORM reset_sequence(TG_TABLE_NAME::text, TG_TABLE_NAME || '_id_seq');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to reset sequences after truncate
DROP TRIGGER IF EXISTS after_truncate_people ON people;
CREATE TRIGGER after_truncate_people
  AFTER TRUNCATE ON people
  FOR EACH STATEMENT
  EXECUTE FUNCTION reset_sequences_after_truncate();

DROP TRIGGER IF EXISTS after_truncate_documents ON documents;
CREATE TRIGGER after_truncate_documents
  AFTER TRUNCATE ON documents
  FOR EACH STATEMENT
  EXECUTE FUNCTION reset_sequences_after_truncate();

-- Reset sequences to current max values
SELECT reset_sequence('people', 'people_id_seq');
SELECT reset_sequence('documents', 'documents_id_seq');
