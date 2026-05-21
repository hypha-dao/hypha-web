CREATE TABLE "space_call_artifact_ingest_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "call_session_id" varchar(128) NOT NULL,
  "state" varchar(32) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp,
  "last_error" text,
  "recording_stored" boolean DEFAULT false NOT NULL,
  "transcript_stored" boolean DEFAULT false NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_call_artifact_ingest_runs"
  ADD CONSTRAINT "space_call_artifact_ingest_runs_space_fk"
  FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_call_artifact_ingest_runs"
  ADD CONSTRAINT "space_call_artifact_ingest_runs_state_check"
  CHECK ("state" IN ('pending', 'uploading', 'ingested', 'failed', 'retry_pending'));
--> statement-breakpoint
ALTER TABLE "space_call_artifact_ingest_runs"
  ADD CONSTRAINT "space_call_artifact_ingest_runs_attempts_non_negative"
  CHECK ("attempts" >= 0);
--> statement-breakpoint
CREATE UNIQUE INDEX "space_call_artifact_ingest_runs_space_session_unique"
  ON "space_call_artifact_ingest_runs" USING btree ("space_id","call_session_id");
--> statement-breakpoint
CREATE INDEX "space_call_artifact_ingest_runs_space_idx"
  ON "space_call_artifact_ingest_runs" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "space_call_artifact_ingest_runs_state_retry_idx"
  ON "space_call_artifact_ingest_runs" USING btree ("state","next_retry_at");
--> statement-breakpoint
CREATE INDEX "space_call_artifact_ingest_runs_created_idx"
  ON "space_call_artifact_ingest_runs" USING btree ("created_at");
