CREATE TABLE "space_scheduled_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"location" text,
	"meeting_url" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "space_scheduled_items" ADD CONSTRAINT "space_scheduled_items_creator_id_people_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "space_scheduled_items_space_id_idx" ON "space_scheduled_items" USING btree ("space_id");
--> statement-breakpoint
CREATE INDEX "space_scheduled_items_starts_at_idx" ON "space_scheduled_items" USING btree ("starts_at");
--> statement-breakpoint
CREATE INDEX "space_scheduled_items_space_starts_idx" ON "space_scheduled_items" USING btree ("space_id","starts_at");
--> statement-breakpoint
CREATE INDEX "space_scheduled_items_type_idx" ON "space_scheduled_items" USING btree ("type");
