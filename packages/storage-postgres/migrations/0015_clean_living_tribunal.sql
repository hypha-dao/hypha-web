DROP SEQUENCE IF EXISTS "document_state_transitions_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "document_discussions_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "document_proposals_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "document_votes_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "document_agreement_signatures_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "document_agreements_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "documents_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "memberships_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "people_id_seq" CASCADE;
DROP SEQUENCE IF EXISTS "spaces_id_seq" CASCADE;

ALTER TABLE "document_state_transitions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_state_transitions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_state_transitions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_discussions" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_discussions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_discussions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_proposals" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_proposals" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_proposals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_votes" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_votes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_votes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_agreement_signatures" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_agreement_signatures" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_agreement_signatures_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "document_agreements" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "document_agreements" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "document_agreements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "memberships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "people_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "spaces" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (sequence name "spaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1000 CACHE 1);--> statement-breakpoint
