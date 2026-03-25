CREATE TABLE "token_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer,
	"token_address" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "archived" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "token_updates" ADD CONSTRAINT "token_updates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;