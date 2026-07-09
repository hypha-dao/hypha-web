-- #2290 Personal Bank KYC: let bank_customers be owned by a person OR a space.
-- Existing rows all have space_id set and person_id null, so they satisfy the XOR check.
ALTER TABLE "bank_customers" ALTER COLUMN "space_id" DROP NOT NULL;

ALTER TABLE "bank_customers" ADD COLUMN IF NOT EXISTS "person_id" integer;

ALTER TABLE "bank_customers"
  ADD CONSTRAINT "bank_customers_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "public"."people"("id")
  ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_customers_person_provider_unique"
  ON "bank_customers" USING btree ("person_id", "provider");

ALTER TABLE "bank_customers"
  ADD CONSTRAINT "bank_customers_owner_xor"
  CHECK (("bank_customers"."space_id" IS NOT NULL) <> ("bank_customers"."person_id" IS NOT NULL));
