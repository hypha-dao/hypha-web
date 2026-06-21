import { z } from 'zod';

function coerceOptionalCoordinate(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) {
      return null;
    }
    if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value;
}

export const SPACE_LOCATION_SOURCES = [
  'geocode',
  'manual',
  'map_click',
] as const;

export type SpaceLocationSource = (typeof SPACE_LOCATION_SOURCES)[number];

export const spaceLatitudeSchema = z.preprocess(
  coerceOptionalCoordinate,
  z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
);

export const spaceLongitudeSchema = z.preprocess(
  coerceOptionalCoordinate,
  z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
);

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
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(10).optional(),
});

export type GeocodeRequest = z.infer<typeof geocodeRequestSchema>;

export const geocodeResultSchema = z.object({
  label: z.string(),
  latitude: spaceLatitudeSchema,
  longitude: spaceLongitudeSchema,
  placeId: z.string().optional(),
});

export const geocodeResponseSchema = z.object({
  data: z.array(geocodeResultSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export type GeocodeResult = z.infer<typeof geocodeResultSchema>;
