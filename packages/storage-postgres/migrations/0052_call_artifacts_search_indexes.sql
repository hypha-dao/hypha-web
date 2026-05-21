CREATE INDEX "space_call_transcripts_text_tsv_idx"
  ON "space_call_transcripts"
  USING gin (to_tsvector('english', coalesce("text", '')));
--> statement-breakpoint
CREATE INDEX "space_call_transcripts_summary_tsv_idx"
  ON "space_call_transcripts"
  USING gin (to_tsvector('english', coalesce("summary", '')));
--> statement-breakpoint
CREATE INDEX "space_discussion_summaries_summary_tsv_idx"
  ON "space_discussion_summaries"
  USING gin (to_tsvector('english', coalesce("summary", '')));
