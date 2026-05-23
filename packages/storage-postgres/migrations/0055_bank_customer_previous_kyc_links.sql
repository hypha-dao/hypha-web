ALTER TABLE "bank_customers" ADD COLUMN "previous_kyc_links" jsonb DEFAULT '[]'::jsonb NOT NULL;
