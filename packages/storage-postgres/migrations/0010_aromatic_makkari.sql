ALTER TABLE "documents" ADD CONSTRAINT "documents_creator_id_people_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;