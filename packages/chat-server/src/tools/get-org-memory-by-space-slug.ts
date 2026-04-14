import { z } from 'zod';
import { getOrgMemoryBySpaceSlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import type { ChatRouteTool } from './types';
import { sanitizeSlug } from '../system-prompt';

export function createGetOrgMemoryBySpaceSlugTool(
  authToken: string,
  requestUrlForSessionMatrix?: string,
) {
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
      'Read-only: organisation memory for a Hypha space by slug — same member roster as get_people_by_space_slug plus org_memory_assets (proposal attachments and lead images from documents; Matrix chat m.file/m.image when NEXT_PUBLIC_MATRIX_HOMESERVER_URL and chat_room_id are set, and either HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN is set **or** the signed-in user has a Matrix link from Human Chat — then used_session_matrix_token is true). Each successful result includes matrix_fetch: skipped_reason (missing_homeserver_url | missing_access_token | missing_chat_room_id), used_bot_access_token, used_session_matrix_token, session_matrix_token_unavailable (JWT ok but no Matrix session / expired token), homeserver_configured, access_token_configured (HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN only — false does NOT mean Matrix is impossible if used_session_matrix_token is true), http_status, events_in_chunk, media_events_yielded, hypha_media_bundle_slots, error — use these for why Matrix rows are empty; do not infer failure only from access_token_configured or missing bot token; do not blame generic access permissions. Optional assets_page, assets_page_size, assets_search paginate/filter assets separately from the roster. Not a substitute for get_documents_by_space_slug for governance workflow (state, status, creator) on each document row.',
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
            requestUrlForSessionMatrix,
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
