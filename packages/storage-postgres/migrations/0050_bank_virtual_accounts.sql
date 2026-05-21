CREATE TABLE "bank_virtual_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_customer_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_virtual_account_id" text NOT NULL,
	"currency" text NOT NULL,
	"payment_rail" text NOT NULL,
	"deposit_instructions" jsonb NOT NULL,
	"destination_address" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_virtual_accounts" ADD CONSTRAINT "bank_virtual_accounts_bank_customer_id_bank_customers_id_fk" FOREIGN KEY ("bank_customer_id") REFERENCES "public"."bank_customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_virtual_accounts_customer_currency_rail_unique" ON "bank_virtual_accounts" USING btree ("bank_customer_id","currency","payment_rail");
