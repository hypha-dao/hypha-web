-- Validate the FK added as NOT VALID in 0072 in its own migration so the
-- validation scan runs in a separate transaction and does not block writes
-- for the duration of the previous migration.
ALTER TABLE "deals" VALIDATE CONSTRAINT "deals_account_manager_id_people_id_fk";
