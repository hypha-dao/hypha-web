ALTER TABLE "space_quests" ADD COLUMN IF NOT EXISTS "deliverables_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "space_quests" AS q
SET "deliverables_enabled" = true
WHERE EXISTS (
  SELECT 1
  FROM "space_quest_deliverables" AS d
  WHERE d."quest_id" = q."id"
);
