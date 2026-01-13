CREATE TABLE "matrix_user_links" (
	"id" serial PRIMARY KEY NOT NULL,
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
CREATE INDEX "search_index_matrix_user_links" ON "matrix_user_links" USING gin ((
      setweight(to_tsvector('english', "privy_user_id"), 'A') ||
      setweight(to_tsvector('english', "matrix_user_id"), 'B') ||
      setweight(to_tsvector('english', "encrypted_access_token"), 'C') ||
      setweight(to_tsvector('english', "device_id"), 'D') ||
      setweight(to_tsvector('english', "refresh_token"), 'E')
    ));