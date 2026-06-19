import { z } from 'zod';
import { searchNominatim } from '@hypha-platform/core/server';
import type { ChatRouteTool } from './types';

const inputSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(5).optional().default(3),
});

export function createGeocodeSpaceLocationTool() {
  return {
    description:
      'Resolve a place name into coordinates for space onboarding. Use after the user shares a city, region, or landmark. Returns label + latitude + longitude candidates to confirm with the user before create_space_from_onboarding.',
    inputSchema,
    execute: async (args) => {
      const parsed = inputSchema.safeParse(args);
      if (!parsed.success) return { ok: false, error: parsed.error.message };

      try {
        const results = await searchNominatim(
          parsed.data.query,
          parsed.data.limit,
        );
        if (results.length === 0) {
          return {
            ok: true,
            found: false,
            query: parsed.data.query,
            results: [],
            next_step:
              'No matching places were found. Ask the user to rephrase with a city, region, or country.',
          };
        }

        return {
          ok: true,
          found: true,
          query: parsed.data.query,
          results: results.map((result) => ({
            label: result.label,
            latitude: result.latitude,
            longitude: result.longitude,
            place_id: result.placeId ?? null,
          })),
          next_step:
            results.length === 1
              ? 'One match found. Confirm with the user, then pass latitude, longitude, and location_label into create_space_from_onboarding.'
              : 'Multiple matches found. Ask the user which place they mean, then pass the chosen coordinates into create_space_from_onboarding.',
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Geocoding failed.';
        return { ok: false, error: message };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
