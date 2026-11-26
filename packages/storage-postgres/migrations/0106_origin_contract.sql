-- #2724: server-set origin of signals and quests. CONTRACT step of 0105_origin_columns.
-- Merge and deploy ONLY after the code that passes an origin on every write is live (all quest and signal
-- writers). From then on a write without an origin fails instead of being stored as 'unknown'; rows written
-- before 0105 keep 'unknown'.
-- Also drops space_quest_updates.via_agent, replaced by the origin columns; no code reads or writes it.
-- Rollback: ALTER TABLE <t> ALTER COLUMN origin_kind SET DEFAULT 'unknown' (for the three tables), and
--   ALTER TABLE space_quest_updates ADD COLUMN IF NOT EXISTS via_agent boolean NOT NULL DEFAULT false
--   (the old values were all false: no writer ever set it).
-- Hand-authored (repo convention: IF EXISTS; drizzle-kit generate/push are not used for authoring).

ALTER TABLE "coherences" ALTER COLUMN "origin_kind" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "space_quests" ALTER COLUMN "origin_kind" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "space_quest_updates" ALTER COLUMN "origin_kind" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "space_quest_updates" DROP COLUMN IF EXISTS "via_agent";
