CREATE TABLE "space_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"status" text DEFAULT 'incomplete' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_subscription_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_subscription_id" integer NOT NULL,
	"stripe_invoice_id" text NOT NULL,
	"amount_usdc" text NOT NULL,
	"settlement_status" text DEFAULT 'pending' NOT NULL,
	"settlement_error" text,
	"tx_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_subscriptions" ADD CONSTRAINT "space_subscriptions_space_id_spaces_id_fk"
  FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_subscriptions" ADD CONSTRAINT "space_subscriptions_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_subscription_invoices" ADD CONSTRAINT "space_subscription_invoices_space_subscription_id_space_subscriptions_id_fk"
  FOREIGN KEY ("space_subscription_id") REFERENCES "public"."space_subscriptions"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "space_subscriptions_stripe_subscription_id_unique" ON "space_subscriptions" USING btree ("stripe_subscription_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "space_subscription_invoices_stripe_invoice_id_unique" ON "space_subscription_invoices" USING btree ("stripe_invoice_id");
