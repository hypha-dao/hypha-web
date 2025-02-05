CREATE TYPE "public"."agreement_state" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."governance_state" AS ENUM('discussion', 'proposal', 'agreement');--> statement-breakpoint
CREATE TYPE "public"."vote_type" AS ENUM('yes', 'no', 'abstain');--> statement-breakpoint
CREATE TABLE "document_state_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"from_state" "governance_state" NOT NULL,
	"to_state" "governance_state" NOT NULL,
	"transitioned_by" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_discussions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"parent_id" integer,
	"author_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"voting_starts_at" timestamp NOT NULL,
	"voting_ends_at" timestamp NOT NULL,
	"min_votes_required" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"voter_id" integer NOT NULL,
	"vote" "vote_type" NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_agreement_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"agreement_id" integer NOT NULL,
	"signer_id" integer NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_agreements" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"final_state" "agreement_state" NOT NULL,
	"ratified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_state_transitions" ADD CONSTRAINT "document_state_transitions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_state_transitions" ADD CONSTRAINT "document_state_transitions_transitioned_by_people_id_fk" FOREIGN KEY ("transitioned_by") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_discussions" ADD CONSTRAINT "document_discussions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_discussions" ADD CONSTRAINT "document_discussions_parent_id_document_discussions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_discussions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_discussions" ADD CONSTRAINT "document_discussions_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_proposals" ADD CONSTRAINT "document_proposals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_votes" ADD CONSTRAINT "document_votes_proposal_id_document_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."document_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_votes" ADD CONSTRAINT "document_votes_voter_id_people_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_agreement_signatures" ADD CONSTRAINT "document_agreement_signatures_agreement_id_document_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."document_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_agreement_signatures" ADD CONSTRAINT "document_agreement_signatures_signer_id_people_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_agreements" ADD CONSTRAINT "document_agreements_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;