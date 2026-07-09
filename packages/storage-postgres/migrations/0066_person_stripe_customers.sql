CREATE TABLE "person_stripe_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"person_id" integer NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_stripe_customers" ADD CONSTRAINT "person_stripe_customers_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "person_stripe_customers_person_id_unique" ON "person_stripe_customers" USING btree ("person_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "person_stripe_customers_stripe_customer_id_unique" ON "person_stripe_customers" USING btree ("stripe_customer_id");
