-- #2610 G2a: per-space grants for AI clients (authorization server). Additive only.
-- One header row per person and client says HOW MUCH was granted ('all' = everything the person
-- can see, including spaces joined later; 'spaces' = only the rows in as_client_grant_space).
-- No header row means nothing is granted (the token hook then issues an empty list).
-- `level` is 'read' only in this release; 'write' is reserved and needs a later migration that widens the CHECK.
-- Hand-authored (repo convention: IF NOT EXISTS; drizzle-kit generate/migrate/push are not used).
CREATE TABLE IF NOT EXISTS "as_client_grant" ("userId" text not null references "as_user" ("id") on delete cascade, "clientId" text not null references "as_oauth_client" ("clientId") on delete cascade, "mode" text not null check ("mode" in ('all', 'spaces')), "level" text not null default 'read' check ("level" in ('read')), "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, primary key ("userId", "clientId"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_client_grant_space" ("userId" text not null, "clientId" text not null, "spaceId" integer not null references "spaces" ("id") on delete cascade, "level" text not null default 'read' check ("level" in ('read')), primary key ("userId", "clientId", "spaceId"), foreign key ("userId", "clientId") references "as_client_grant" ("userId", "clientId") on delete cascade);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_client_grant_space_spaceId_idx" on "as_client_grant_space" ("spaceId");
--> statement-breakpoint
ALTER TABLE "as_client_grant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_client_grant_space" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Connections approved before this release were all-or-nothing: keep them working, explicitly.
INSERT INTO "as_client_grant" ("userId", "clientId", "mode")
SELECT "userId", "clientId", 'all' FROM "as_oauth_consent" WHERE "userId" IS NOT NULL
ON CONFLICT ("userId", "clientId") DO NOTHING;
