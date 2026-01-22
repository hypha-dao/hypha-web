ALTER TABLE "coherences" ADD COLUMN "views" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "coherences" ADD COLUMN "messages" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "search_status" ON "coherences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "search_type" ON "coherences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "search_slug" ON "coherences" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "search_room_id" ON "coherences" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "search_archived" ON "coherences" USING btree ("archived");--> statement-breakpoint
CREATE INDEX "search_views" ON "coherences" USING btree ("views");--> statement-breakpoint
CREATE INDEX "search_messages" ON "coherences" USING btree ("messages");--> statement-breakpoint
CREATE INDEX "search_tags" ON "coherences" USING btree ("tags");