ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_account_manager_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_account_manager_id_people_id_fk" FOREIGN KEY ("account_manager_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action NOT VALID;
