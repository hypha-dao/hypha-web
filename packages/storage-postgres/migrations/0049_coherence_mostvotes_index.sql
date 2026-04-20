CREATE INDEX IF NOT EXISTS "search_vote_score_created_at"
  ON "coherences" ("vote_score" DESC, "created_at" DESC);
