-- #2515 client registration: optional logo for an integration client, stored as the public URL of the
-- file in Hypha's file storage. Nullable; shown to people only once the client is approved.
-- Hand-authored (repo convention; drizzle-kit generate/migrate/push are not used for new migrations).
ALTER TABLE "integration_clients" ADD COLUMN IF NOT EXISTS "logo_url" text;
