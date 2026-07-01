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
      'Resolve a place name into coordinates for internal use only. During onboarding discover phase, do NOT call this tool—direct the user to the address search and map card in chat instead. Never present latitude or longitude to the user.',
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
              ? 'Do not show coordinates to the user. Ask them to confirm the place using the address search and map card in chat.'
              : 'Do not show coordinates to the user. Ask them to pick the correct place using the address search and map card in chat.',
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Geocoding failed.';
        return { ok: false, error: message };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
