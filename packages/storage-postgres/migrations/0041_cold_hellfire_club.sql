CREATE TABLE "coherences" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"space_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'signal',
	"type" text NOT NULL,
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
CREATE TABLE "matrix_user_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"privy_user_id" text NOT NULL,
	"matrix_user_id" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"device_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "coherences" ADD CONSTRAINT "coherences_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_index_coherences" ON "coherences" USING gin ((
          setweight(to_tsvector('english', "title"), 'A') ||
          setweight(to_tsvector('english', "description"), 'B')
      ));--> statement-breakpoint
CREATE INDEX "search_status" ON "coherences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_type" ON "coherences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "search_slug" ON "coherences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "search_room_id" ON "coherences" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "search_archived" ON "coherences" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "search_views" ON "coherences" USING btree ("views");--> statement-breakpoint
CREATE INDEX "search_messages" ON "coherences" USING btree ("messages");--> statement-breakpoint
CREATE INDEX "search_tags" ON "coherences" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "search_environment" ON "matrix_user_links" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "search_privy_user_id" ON "matrix_user_links" USING btree ("privy_user_id");--> statement-breakpoint
CREATE INDEX "search_matrix_user_id" ON "matrix_user_links" USING btree ("matrix_user_id");--> statement-breakpoint
CREATE INDEX "search_encrypted_access_token" ON "matrix_user_links" USING btree ("encrypted_access_token");--> statement-breakpoint
CREATE INDEX "search_device_id" ON "matrix_user_links" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "search_refresh_token" ON "matrix_user_links" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX "search_token_expires_at" ON "matrix_user_links" USING btree ("token_expires_at");