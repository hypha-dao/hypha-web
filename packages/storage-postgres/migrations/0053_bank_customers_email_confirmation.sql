ALTER TABLE "bank_customers" ADD COLUMN "jwt_nonce" uuid;
--> statement-breakpoint
ALTER TABLE "bank_customers" ALTER COLUMN "provider_kyc_link_id" DROP NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_customers_jwt_nonce_unique" ON "bank_customers" USING btree ("jwt_nonce") WHERE "jwt_nonce" IS NOT NULL;
