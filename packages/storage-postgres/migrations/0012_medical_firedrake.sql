ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "people" ALTER COLUMN "sub" SET DEFAULT (auth.user_id());--> statement-breakpoint
CREATE POLICY "crud-authenticated-policy-select" ON "people" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.user_id() = "people"."sub"));--> statement-breakpoint
CREATE POLICY "crud-authenticated-policy-insert" ON "people" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.user_id() = "people"."sub"));--> statement-breakpoint
CREATE POLICY "crud-authenticated-policy-update" ON "people" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.user_id() = "people"."sub")) WITH CHECK ((select auth.user_id() = "people"."sub"));--> statement-breakpoint
CREATE POLICY "crud-authenticated-policy-delete" ON "people" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.user_id() = "people"."sub"));