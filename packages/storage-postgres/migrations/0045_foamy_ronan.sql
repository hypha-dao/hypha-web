CREATE TABLE "coherences" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"space_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"slug" varchar(255),
	"room_id" text,
	"archived" boolean DEFAULT false,
	"views" integer DEFAULT 0,
	"messages" integer DEFAULT 0,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coherences" ADD CONSTRAINT "coherences_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_index_coherences" ON "coherences" USING gin ((
          setweight(to_tsvector('english', "title"), 'A') ||
          setweight(to_tsvector('english', "description"), 'B')
      ));--> statement-breakpoint
CREATE INDEX "search_type" ON "coherences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "search_priority" ON "coherences" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "search_slug" ON "coherences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "search_room_id" ON "coherences" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "search_archived" ON "coherences" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "search_views" ON "coherences" USING btree ("views");--> statement-breakpoint
CREATE INDEX "search_messages" ON "coherences" USING btree ("messages");--> statement-breakpoint
CREATE INDEX "search_tags" ON "coherences" USING btree ("tags");