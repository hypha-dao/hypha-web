CREATE TABLE "signal_orchestrator_queue" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "state" varchar(32) DEFAULT 'pending' NOT NULL,
  "trigger_kind" varchar(64) NOT NULL,
  "event_count" integer DEFAULT 1 NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "due_at" timestamp DEFAULT now() NOT NULL,
  "processing_started_at" timestamp,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_error" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_queue"
  ADD CONSTRAINT "signal_orchestrator_queue_event_count_non_negative"
    CHECK ("event_count" >= 0),
  ADD CONSTRAINT "signal_orchestrator_queue_attempts_non_negative"
    CHECK ("attempts" >= 0);
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_queue"
  ADD CONSTRAINT "signal_orchestrator_queue_state_check"
    CHECK ("state" IN ('pending', 'processing', 'done', 'failed', 'discarded'));
--> statement-breakpoint
CREATE TABLE "signal_orchestrator_cooldowns" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "key" varchar(128) NOT NULL,
  "cooldown_until" timestamp NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_orchestrator_dispatches" (
  "id" serial PRIMARY KEY NOT NULL,
  "queue_id" integer,
  "source_space_id" integer NOT NULL,
  "target_space_id" integer,
  "emitted_signal_id" integer,
  "mode" varchar(32) NOT NULL,
  "decision" varchar(32) NOT NULL,
  "relevance_score" integer DEFAULT 0 NOT NULL,
  "novelty_score" integer DEFAULT 0 NOT NULL,
  "actionability_score" integer DEFAULT 0 NOT NULL,
  "confidence_score" integer DEFAULT 0 NOT NULL,
  "rationale" text,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_dispatches"
  ADD CONSTRAINT "signal_orchestrator_dispatches_mode_check"
    CHECK ("mode" IN ('space', 'relay')),
  ADD CONSTRAINT "signal_orchestrator_dispatches_decision_check"
    CHECK ("decision" IN ('emitted', 'suppressed', 'error', 'discarded'));
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_queue" ADD CONSTRAINT "signal_orchestrator_queue_space_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_cooldowns" ADD CONSTRAINT "signal_orchestrator_cooldowns_space_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_dispatches" ADD CONSTRAINT "signal_orchestrator_dispatches_queue_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."signal_orchestrator_queue"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_dispatches" ADD CONSTRAINT "signal_orchestrator_dispatches_source_space_fk" FOREIGN KEY ("source_space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_dispatches" ADD CONSTRAINT "signal_orchestrator_dispatches_target_space_fk" FOREIGN KEY ("target_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "signal_orchestrator_dispatches" ADD CONSTRAINT "signal_orchestrator_dispatches_emitted_signal_fk" FOREIGN KEY ("emitted_signal_id") REFERENCES "public"."coherences"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_queue_space_idx" ON "signal_orchestrator_queue" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_queue_state_due_idx" ON "signal_orchestrator_queue" USING btree ("state","due_at");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_queue_created_idx" ON "signal_orchestrator_queue" USING btree ("created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "signal_orchestrator_queue_space_pending_unique" ON "signal_orchestrator_queue" USING btree ("space_id") WHERE "state" = 'pending';
--> statement-breakpoint
CREATE UNIQUE INDEX "signal_orchestrator_cooldowns_space_key_unique" ON "signal_orchestrator_cooldowns" USING btree ("space_id","key");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_cooldowns_until_idx" ON "signal_orchestrator_cooldowns" USING btree ("cooldown_until");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_queue_idx" ON "signal_orchestrator_dispatches" USING btree ("queue_id");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_source_idx" ON "signal_orchestrator_dispatches" USING btree ("source_space_id");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_target_idx" ON "signal_orchestrator_dispatches" USING btree ("target_space_id");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_emitted_signal_idx" ON "signal_orchestrator_dispatches" USING btree ("emitted_signal_id");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_mode_decision_idx" ON "signal_orchestrator_dispatches" USING btree ("mode","decision");
--> statement-breakpoint
CREATE INDEX "signal_orchestrator_dispatches_created_idx" ON "signal_orchestrator_dispatches" USING btree ("created_at");
