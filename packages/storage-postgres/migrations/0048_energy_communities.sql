CREATE TABLE "energy_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"chain_id" integer DEFAULT 8453 NOT NULL,
	"community_proxy_address" text NOT NULL,
	"energy_token_address" text NOT NULL,
	"admin_address" text NOT NULL,
	"factory_community_id" integer,
	"activated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "energy_communities" ADD CONSTRAINT "energy_communities_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "energy_communities_space_id_uidx" ON "energy_communities" USING btree ("space_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "energy_communities_proxy_uidx" ON "energy_communities" USING btree ("community_proxy_address");
--> statement-breakpoint
CREATE INDEX "energy_communities_admin_idx" ON "energy_communities" USING btree ("admin_address");
