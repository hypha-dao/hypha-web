CREATE TABLE "bank_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_kyc_link_id" text NOT NULL,
	"requested_rails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_customers" ADD CONSTRAINT "bank_customers_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_customers_space_provider_unique" ON "bank_customers" USING btree ("space_id","provider");
