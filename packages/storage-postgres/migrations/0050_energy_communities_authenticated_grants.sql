-- energy_communities is written from API routes using Neon JWT auth (role
-- "authenticated"). Serial PK inserts require sequence rights; upserts need
-- table INSERT/UPDATE (see people_id_seq grant in 0013).
GRANT SELECT, INSERT, UPDATE ON TABLE "energy_communities" TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE "energy_communities_id_seq" TO authenticated;
