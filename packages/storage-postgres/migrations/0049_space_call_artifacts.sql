CREATE TABLE IF NOT EXISTS "space_call_recordings" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
  "call_session_id" varchar(128) NOT NULL,
  "media_uri" text NOT NULL,
  "storage_key" text,
  "mime_type" varchar(255) NOT NULL,
  "duration_seconds" integer,
  "started_at" timestamptz,
  "ended_at" timestamptz,
  "source" varchar(128) DEFAULT 'unknown' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "space_call_recordings_space_session_unique"
  ON "space_call_recordings" ("space_id", "call_session_id");
CREATE INDEX IF NOT EXISTS "space_call_recordings_space_idx"
  ON "space_call_recordings" ("space_id");
CREATE INDEX IF NOT EXISTS "space_call_recordings_created_idx"
  ON "space_call_recordings" ("created_at");

CREATE TABLE IF NOT EXISTS "space_call_transcripts" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
  "call_session_id" varchar(128) NOT NULL,
  "language" varchar(32) DEFAULT 'und' NOT NULL,
  "text" text NOT NULL,
  "summary" text,
  "source" varchar(128) DEFAULT 'unknown' NOT NULL,
  "segments" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "space_call_transcripts_space_session_unique"
  ON "space_call_transcripts" ("space_id", "call_session_id");
CREATE INDEX IF NOT EXISTS "space_call_transcripts_space_idx"
  ON "space_call_transcripts" ("space_id");
CREATE INDEX IF NOT EXISTS "space_call_transcripts_created_idx"
  ON "space_call_transcripts" ("created_at");

CREATE TABLE IF NOT EXISTS "space_discussion_summaries" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL REFERENCES "spaces"("id") ON DELETE cascade,
  "matrix_room_id" text NOT NULL,
  "summary" text NOT NULL,
  "bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "participant_count" integer DEFAULT 0 NOT NULL,
  "source" varchar(128) DEFAULT 'heuristic' NOT NULL,
  "window_start" timestamptz,
  "window_end" timestamptz,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "space_discussion_summaries_space_idx"
  ON "space_discussion_summaries" ("space_id");
CREATE INDEX IF NOT EXISTS "space_discussion_summaries_room_idx"
  ON "space_discussion_summaries" ("matrix_room_id");
CREATE INDEX IF NOT EXISTS "space_discussion_summaries_created_idx"
  ON "space_discussion_summaries" ("created_at");
