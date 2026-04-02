CREATE TABLE "matrix_user_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"privy_user_id" text NOT NULL,
	"matrix_user_id" text NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"device_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "matrix_user_links_env_privy_unique" ON "matrix_user_links" USING btree ("environment", "privy_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matrix_user_links_env_matrix_unique" ON "matrix_user_links" USING btree ("environment", "matrix_user_id");--> statement-breakpoint
CREATE INDEX "search_environment" ON "matrix_user_links" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "search_privy_user_id" ON "matrix_user_links" USING btree ("privy_user_id");--> statement-breakpoint
CREATE INDEX "search_matrix_user_id" ON "matrix_user_links" USING btree ("matrix_user_id");