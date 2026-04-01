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
CREATE INDEX "search_environment" ON "matrix_user_links" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "search_privy_user_id" ON "matrix_user_links" USING btree ("privy_user_id");--> statement-breakpoint
CREATE INDEX "search_matrix_user_id" ON "matrix_user_links" USING btree ("matrix_user_id");--> statement-breakpoint
CREATE INDEX "search_encrypted_access_token" ON "matrix_user_links" USING btree ("encrypted_access_token");--> statement-breakpoint
CREATE INDEX "search_device_id" ON "matrix_user_links" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "search_refresh_token" ON "matrix_user_links" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX "search_token_expires_at" ON "matrix_user_links" USING btree ("token_expires_at");