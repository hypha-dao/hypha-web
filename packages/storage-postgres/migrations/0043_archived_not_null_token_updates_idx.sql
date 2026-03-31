UPDATE "tokens" SET "archived" = false WHERE "archived" IS NULL;--> statement-breakpoint
ALTER TABLE "tokens" ALTER COLUMN "archived" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "token_updates" ALTER COLUMN "document_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "token_updates_document_id_idx" ON "token_updates" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "token_updates_token_address_idx" ON "token_updates" USING btree ("token_address");