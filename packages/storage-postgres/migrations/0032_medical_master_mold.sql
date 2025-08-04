CREATE TABLE "tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"agreement_id" integer,
	"space_id" integer,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"max_supply" integer NOT NULL,
	"type" text NOT NULL,
	"icon_url" text,
	"transferable" boolean NOT NULL,
	"is_voting_token" boolean NOT NULL,
	"decay_interval" integer,
	"decay_percentage" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_agreement_id_documents_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;