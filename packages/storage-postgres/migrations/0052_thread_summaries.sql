CREATE TABLE IF NOT EXISTS "thread_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"matrix_room_id" text NOT NULL,
	"thread_kind" varchar(32) NOT NULL,
	"coherence_slug" varchar(255),
	"thread_title" varchar(512),
	"summary" text DEFAULT '' NOT NULL,
	"bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"last_summarized_event_id" text,
	"last_message_event_id" text,
	"last_message_origin_server_ts" bigint,
	"last_summarized_origin_server_ts" bigint,
	"last_refreshed_at" timestamp with time zone,
	"source" varchar(128) DEFAULT 'llm' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_summaries" ADD CONSTRAINT "thread_summaries_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "thread_summaries_space_room_unique" ON "thread_summaries" USING btree ("space_id","matrix_room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_summaries_space_idx" ON "thread_summaries" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_summaries_updated_idx" ON "thread_summaries" USING btree ("updated_at");
