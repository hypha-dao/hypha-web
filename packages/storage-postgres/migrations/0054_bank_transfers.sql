CREATE TABLE "bank_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_customer_id" integer NOT NULL,
	"provider" text NOT NULL,
	"provider_transfer_id" text NOT NULL,
	"currency" text NOT NULL,
	"payment_rail" text NOT NULL,
	"amount" text,
	"deposit_message" text NOT NULL,
	"status" text NOT NULL,
	"deposit_instructions" jsonb NOT NULL,
	"destination_address" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_bank_customer_id_bank_customers_id_fk" FOREIGN KEY ("bank_customer_id") REFERENCES "public"."bank_customers"("id") ON DELETE no action ON UPDATE no action;
