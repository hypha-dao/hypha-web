CREATE TABLE "spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"logo_url" text,
	"lead_image" text,
	"title" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"parent_id" serial NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_parent_id_spaces_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;