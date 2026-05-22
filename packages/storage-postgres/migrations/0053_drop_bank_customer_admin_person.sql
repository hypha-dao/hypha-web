ALTER TABLE "bank_customers" DROP CONSTRAINT "bank_customers_admin_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "bank_customers" DROP COLUMN "admin_person_id";
