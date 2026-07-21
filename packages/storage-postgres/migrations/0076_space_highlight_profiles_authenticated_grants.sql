-- space_highlight_profiles is written from API routes using Neon JWT auth
-- (role "authenticated"). Serial PK inserts require sequence rights.
GRANT SELECT, INSERT, UPDATE ON TABLE "space_highlight_profiles" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE "space_highlight_profiles_id_seq" TO authenticated;
