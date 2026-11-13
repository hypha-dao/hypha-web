-- One-time purge of placeholder quests seeded by earlier preview runs.
-- Previously this DELETE ran on every quest list read.
-- Fail-safe: require the original seed name+slug+health_summary triples and a
-- null lead. createSpaceQuest can leave creator_person_id NULL, so that alone
-- is not a seed discriminator. Ambiguous rows are left in place.
DELETE FROM "space_quests"
WHERE "creator_person_id" IS NULL
  AND "proposal_document_id" IS NULL
  AND "lead_person_id" IS NULL
  AND ("slug", "name", "health_summary") IN (
    (
      'space-context-mvp',
      'Space Context MVP',
      'M1 shipped on time. Updates this week cover the section editor (PR #2602 in review) and the specialist prompts. Watch-point: review on the read spec this week keeps the Nov 20 target on track.'
    ),
    (
      'agent-gateway',
      'Agent gateway',
      'Auth spec waiting on review for 1 day.'
    ),
    (
      'onboarding-matcher',
      'Onboarding matcher',
      'Scoped v1 and aligned survey signals with Space Context.'
    ),
    (
      'treasury-reporting',
      'Treasury reporting',
      'No update in 6 days on export.'
    ),
    (
      'website-refresh',
      'Website refresh',
      'Proposed, waiting for votes.'
    ),
    (
      'q3-governance-audit',
      'Q3 governance audit',
      'All 3 milestones completed and final summary posted.'
    )
  );
