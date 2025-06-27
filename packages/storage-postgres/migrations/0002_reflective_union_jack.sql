CREATE TABLE "space_configs" (
	"space_slug" text PRIMARY KEY NOT NULL,
	"storage" json DEFAULT '{"space":"postgres","agreement":"postgres","member":"postgres","comment":"postgres"}'::json NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "space_configs" ADD CONSTRAINT "space_configs_space_slug_spaces_slug_fk" FOREIGN KEY ("space_slug") REFERENCES "public"."spaces"("slug") ON DELETE no action ON UPDATE no action;