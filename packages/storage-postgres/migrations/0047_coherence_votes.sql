ALTER TABLE "coherences" ADD COLUMN "vote_score" integer DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS "search_vote_score" ON "coherences" ("vote_score");

CREATE TABLE IF NOT EXISTS "coherence_votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "coherence_id" integer NOT NULL,
  "person_id" integer NOT NULL,
  "value" smallint NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "coherence_votes_coherence_id_coherences_id_fk"
    FOREIGN KEY ("coherence_id") REFERENCES "coherences"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "coherence_votes_person_id_people_id_fk"
    FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "coherence_votes_value_check" CHECK ("value" IN (-1, 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS "coherence_votes_coherence_person_uidx"
  ON "coherence_votes" ("coherence_id", "person_id");

CREATE INDEX IF NOT EXISTS "coherence_votes_coherence_id_idx"
  ON "coherence_votes" ("coherence_id");

UPDATE "coherences" AS c
SET "vote_score" = COALESCE(v.score, 0)
FROM (
  SELECT "coherence_id", SUM("value")::integer AS score
  FROM "coherence_votes"
  GROUP BY "coherence_id"
) AS v
WHERE c.id = v.coherence_id;
