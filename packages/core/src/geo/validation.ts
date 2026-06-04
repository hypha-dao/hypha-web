import { z } from 'zod';

export const SPACE_LOCATION_SOURCES = [
  'geocode',
  'manual',
  'map_click',
] as const;

export type SpaceLocationSource = (typeof SPACE_LOCATION_SOURCES)[number];

export const spaceLatitudeSchema = z
  .number()
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const spaceLongitudeSchema = z
  .number()
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

export const spaceLocationLabelSchema = z.string().trim().max(500);

export const spaceLocationSourceSchema = z.enum(SPACE_LOCATION_SOURCES);

export const spaceLocationFieldsSchema = z
  .object({
    latitude: spaceLatitudeSchema.nullable().optional(),
    longitude: spaceLongitudeSchema.nullable().optional(),
    locationLabel: spaceLocationLabelSchema.nullable().optional(),
    locationSource: spaceLocationSourceSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.latitude != null;
    const hasLng = value.longitude != null;
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Latitude and longitude must both be set or both be cleared',
        path: hasLat ? ['longitude'] : ['latitude'],
      });
    }
  });

export const geocodeRequestSchema = z.object({
  query: z.string().trim().min(2).max(200),
  limit: z.number().int().min(1).max(10).optional(),
});

export type GeocodeRequest = z.infer<typeof geocodeRequestSchema>;

export const geocodeResultSchema = z.object({
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  placeId: z.string().optional(),
});

export const geocodeResponseSchema = z.object({
  results: z.array(geocodeResultSchema),
});

export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
