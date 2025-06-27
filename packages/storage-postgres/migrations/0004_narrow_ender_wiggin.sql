CREATE TYPE "public"."document_state" AS ENUM('discussion', 'proposal', 'agreement');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"title" text,
	"description" text,
	"state" "document_state" DEFAULT 'discussion',
	"slug" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
