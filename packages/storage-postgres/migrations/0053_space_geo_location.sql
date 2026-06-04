ALTER TABLE "spaces" ADD COLUMN "latitude" double precision;
ALTER TABLE "spaces" ADD COLUMN "longitude" double precision;
ALTER TABLE "spaces" ADD COLUMN "location_label" text;
ALTER TABLE "spaces" ADD COLUMN "location_source" text;
ALTER TABLE "spaces" ADD COLUMN "located_at" timestamp;

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_geo_coords_paired" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL)
  OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
);

CREATE INDEX "spaces_geo_idx" ON "spaces" ("latitude", "longitude")
WHERE "latitude" IS NOT NULL;
