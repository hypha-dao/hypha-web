import { z } from 'zod';
import { getOrgMemoryBySpaceSlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetOrgMemoryBySpaceSlugTool(authToken: string) {
  const inputSchema = z.object({
    space_slug: z
      .string()
      .trim()
      .min(1)
      .describe('Hypha space slug of the active space'),
    page: z.number().int().min(1).optional().default(1),
    page_size: z.number().int().min(1).max(100).optional().default(20),
    searchTerm: z.string().optional(),
    assets_page: z.number().int().min(1).optional().default(1),
    assets_page_size: z.number().int().min(1).max(100).optional().default(50),
    assets_search: z.string().optional(),
  });

  return {
    description:
      'Read-only: organisation memory for a Hypha space by slug — same member roster as get_people_by_space_slug plus org_memory_assets (proposal attachments and lead images from documents; Matrix chat m.file/m.image when the deployment sets HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN and NEXT_PUBLIC_MATRIX_HOMESERVER_URL and the space has chat_room_id). Each successful result includes matrix_fetch: use skipped_reason (missing_homeserver_url | missing_access_token | missing_chat_room_id), homeserver_configured, access_token_configured, http_status, events_in_chunk, media_events_yielded, hypha_media_bundle_slots, error — tell the user the concrete reason Matrix rows are empty; do not blame the user JWT or generic access permissions for missing Matrix assets. Optional assets_page, assets_page_size, assets_search paginate/filter assets separately from the roster. Not a substitute for get_documents_by_space_slug for governance workflow (state, status, creator) on each document row.',
    inputSchema,
    execute: async (args) => {
      const parsedArgs = inputSchema.safeParse(args);
      if (!parsedArgs.success) {
        return {
          found: false,
          space_slug: '',
          error: parsedArgs.error.message,
        };
      }
      const toolArgs = parsedArgs.data;
      const safe = sanitizeSlug(toolArgs.space_slug);
      if (!safe) {
        return {
          found: false,
          space_slug: toolArgs.space_slug,
          error: 'Invalid space slug format',
        };
      }

      try {
        const gated = await getOrgMemoryBySpaceSlug(
          {
            spaceSlug: safe,
            page: toolArgs.page,
            pageSize: toolArgs.page_size,
            searchTerm: toolArgs.searchTerm,
            assetsPage: toolArgs.assets_page,
            assetsPageSize: toolArgs.assets_page_size,
            assetsSearch: toolArgs.assets_search,
          },
          { db, authToken },
        );

        if (gated.access === 'denied') {
          return {
            found: false,
            space_slug: safe,
            error: gated.message,
          };
        }

        return gated.result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return {
          found: false,
          space_slug: safe,
          error: message,
        };
      }
    },
  } satisfies ChatRouteTool<typeof inputSchema>;
}
