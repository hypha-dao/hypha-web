-- #2288: email-ownership confirmation before Bridge KYB binding. Extends bank_customers in place
-- (no new table) to carry pending-confirmation state — no PII (email) is stored here; that lives
-- only in the signed confirmation JWT, per ADR-0002 data-minimization.
--
-- provider_kyc_link_id becomes nullable: unset while a confirmation is pending (no KYC link
-- created yet). jwt_nonce correlates an inbound confirmation click back to this row and enables
-- instant revocation via rotation (resend/change-email sets a new UUID, invalidating the previously
-- issued JWT's jti).
ALTER TABLE "bank_customers" ALTER COLUMN "provider_kyc_link_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bank_customers" ADD COLUMN "jwt_nonce" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_customers_jwt_nonce_unique" ON "bank_customers" USING btree ("jwt_nonce");
