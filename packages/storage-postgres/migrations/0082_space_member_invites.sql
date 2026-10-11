CREATE TABLE IF NOT EXISTS "space_member_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "space_id" integer NOT NULL,
  "inviter_person_id" integer NOT NULL,
  "invitee_person_id" integer NOT NULL,
  "token" text NOT NULL,
  "accepted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "space_member_invites_space_id_spaces_id_fk"
    FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "space_member_invites_inviter_person_id_people_id_fk"
    FOREIGN KEY ("inviter_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action,
  CONSTRAINT "space_member_invites_invitee_person_id_people_id_fk"
    FOREIGN KEY ("invitee_person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_member_invites_token_unique"
  ON "space_member_invites" USING btree ("token");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "space_member_invite_pending_idx"
  ON "space_member_invites" USING btree ("space_id","invitee_person_id")
  WHERE "accepted_at" IS NULL;
