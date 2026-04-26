LOCK TABLE "matrix_user_links" IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    WITH mapped AS (
      SELECT
        id,
        environment,
        'did:privy:' || (regexp_match(privy_user_id, '^(dev|prev|prod)_privy_did_privy_(.+)$'))[2] AS target_sub
      FROM matrix_user_links
      WHERE privy_user_id ~ '^(dev|prev|prod)_privy_did_privy_.+$'
    )
    SELECT 1
    FROM mapped m
    JOIN matrix_user_links x
      ON x.environment = m.environment
     AND x.privy_user_id = m.target_sub
     AND x.id <> m.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Migration aborted: canonical privy_user_id conflict detected';
  END IF;
END $$;
--> statement-breakpoint
UPDATE matrix_user_links
SET
  privy_user_id = 'did:privy:' || (regexp_match(
    privy_user_id,
    '^(dev|prev|prod)_privy_did_privy_(.+)$'
  ))[2],
  updated_at = now()
WHERE privy_user_id ~ '^(dev|prev|prod)_privy_did_privy_.+$';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM matrix_user_links
    WHERE privy_user_id ~ '^(dev|prev|prod)_privy_did_privy_.+$'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Migration aborted: decorated ids remain after update';
  END IF;
END $$;
