-- One-time purge of placeholder quests seeded by earlier preview runs.
-- Previously this DELETE ran on every quest list read.
DELETE FROM "space_quests"
WHERE "creator_person_id" IS NULL
  AND "proposal_document_id" IS NULL
  AND "slug" IN (
    'space-context-mvp',
    'agent-gateway',
    'onboarding-matcher',
    'treasury-reporting',
    'website-refresh',
    'q3-governance-audit'
  );
