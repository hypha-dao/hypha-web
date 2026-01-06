CREATE TYPE "public"."coherence_status" AS ENUM('signal', 'conversation');--> statement-breakpoint
CREATE TYPE "public"."coherence_tags" AS ENUM('Organization & Governance/Strategy', 'Organization & Governance/Culture', 'Organization & Governance/Onboarding', 'Organization & Governance/Engagement', 'Organization & Governance/Learning', 'Organization & Governance/Capacity', 'Organization & Governance/Network', 'Organization & Governance/Reputation', 'Organization & Governance/Impact', 'Product & Innovation/Innovation', 'Product & Innovation/UX', 'Product & Innovation/Feature Request', 'Product & Innovation/Technical Debt', 'Product & Innovation/Integration', 'Product & Innovation/Adoption', 'Finance & Resources/Funding', 'Finance & Resources/Budget', 'Finance & Resources/Tokenomics', 'Finance & Resources/Resourcing', 'Finance & Resources/Commons Pool', 'External & Ecosystem/Partnership', 'External & Ecosystem/Market', 'External & Ecosystem/Compliance', 'External & Ecosystem/Ecosystem Signal (external trigger)');--> statement-breakpoint
CREATE TYPE "public"."coherence_type" AS ENUM('Opportunity', 'Tension', 'Risk', 'Strategy', 'Innovation', 'Culture', 'Onboarding', 'Engagement', 'Learning', 'Network', 'Capacity', 'Reputation', 'Impact', 'Funding', 'Budget');--> statement-breakpoint
CREATE TABLE "coherences" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer NOT NULL,
	"space_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "coherence_status" DEFAULT 'signal',
	"type" "coherence_type" NOT NULL,
	"slug" varchar(255),
	"room_id" text,
	"archived" boolean DEFAULT false,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coherences" ADD CONSTRAINT "coherences_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_index_coherences" ON "coherences" USING gin ((
          setweight(to_tsvector('english', "title"), 'A') ||
          setweight(to_tsvector('english', "description"), 'B')
      ));