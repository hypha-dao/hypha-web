ALTER TABLE "spaces" ADD COLUMN "latitude" double precision;
ALTER TABLE "spaces" ADD COLUMN "longitude" double precision;
ALTER TABLE "spaces" ADD COLUMN "location_label" text;
ALTER TABLE "spaces" ADD COLUMN "location_source" text;
ALTER TABLE "spaces" ADD COLUMN "located_at" timestamp;

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_geo_coords_paired" CHECK (
  ("latitude" IS NULL AND "longitude" IS NULL)
  OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
);

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_latitude_bounds" CHECK (
  "latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)
);

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_longitude_bounds" CHECK (
  "longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)
);

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_location_source_enum" CHECK (
  "location_source" IS NULL
  OR "location_source" IN ('geocode', 'manual', 'map_click')
);

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_geo_not_null_island" CHECK (
  NOT ("latitude" = 0 AND "longitude" = 0)
);

CREATE INDEX "spaces_geo_idx" ON "spaces" ("latitude", "longitude")
WHERE "latitude" IS NOT NULL;
