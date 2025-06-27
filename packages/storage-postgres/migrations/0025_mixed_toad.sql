CREATE INDEX "search_index_documents" ON "documents" USING gin ((
          setweight(to_tsvector('english', "title"), 'A') ||
          setweight(to_tsvector('english', "description"), 'B')
      ));--> statement-breakpoint
CREATE INDEX "search_index_spaces" ON "spaces" USING gin ((
          setweight(to_tsvector('english', "title"), 'A') ||
          setweight(to_tsvector('english', "description"), 'B')
      ));