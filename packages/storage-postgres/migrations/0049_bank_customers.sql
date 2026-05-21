CREATE TABLE "bank_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"admin_person_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text,
	"provider_kyc_link_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"endorsements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"kyc_status" text NOT NULL,
	"tos_status" text,
	"kyc_link" text,
	"tos_link" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_customers" ADD CONSTRAINT "bank_customers_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_customers" ADD CONSTRAINT "bank_customers_admin_person_id_people_id_fk" FOREIGN KEY ("admin_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_customers_space_provider_unique" ON "bank_customers" USING btree ("space_id","provider");