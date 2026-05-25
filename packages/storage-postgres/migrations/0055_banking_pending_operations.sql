ALTER TABLE "bank_transfers" ALTER COLUMN "provider_transfer_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bank_transfers" ALTER COLUMN "deposit_message" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bank_virtual_accounts" ALTER COLUMN "provider_virtual_account_id" DROP NOT NULL;
