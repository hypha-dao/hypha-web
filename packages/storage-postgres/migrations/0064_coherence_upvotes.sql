CREATE TABLE "coherence_upvotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"coherence_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"voting_power" numeric(78, 0) NOT NULL,
	"max_voting_power" numeric(78, 0) NOT NULL,
	"token_decimals" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coherence_upvotes" ADD CONSTRAINT "coherence_upvotes_coherence_id_coherences_id_fk"
  FOREIGN KEY ("coherence_id") REFERENCES "coherences"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "coherence_upvotes" ADD CONSTRAINT "coherence_upvotes_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "people"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "coherence_upvotes_coherence_person_key" ON "coherence_upvotes" ("coherence_id", "person_id");
--> statement-breakpoint
CREATE INDEX "coherence_upvotes_person_idx" ON "coherence_upvotes" ("person_id");
