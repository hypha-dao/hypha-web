import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getDocumentsBySpaceSlug,
  getOrgMemoryBySpaceSlug,
  getSpaceMembersRoster,
  serializeSpaceMembersRosterDatesForJson,
} from '@hypha-platform/core/server';
import {
  getPeopleBySpaceSlugInputSchema,
  getPeopleBySpaceSlugOutputSchema,
} from './get-people-by-space-slug-schema.js';
import {
  getDocumentsBySpaceSlugInputSchema,
  getDocumentsBySpaceSlugOutputSchema,
} from './get-documents-by-space-slug-schema.js';
import {
  getOrgMemoryBySpaceSlugInputSchema,
  getOrgMemoryBySpaceSlugOutputSchema,
} from './get-org-memory-by-space-slug-schema.js';

const server = new McpServer(
  {
    name: 'hypha-mcp',
    version: '0.0.0',
  },
  {
    instructions:
      'Hypha read-only tools: space members by slug; org memory (roster + future catalogue assets) by slug; documents (proposals/discussions/agreements) in a space by slug.',
  },
);

server.registerTool(
  'get_people_by_space_slug',
  {
    description:
      'Read-only: list members of the active Hypha space (by slug), including people and other spaces that are members (on-chain roster). Includes full memberships row fields for people when present in the database.',
    inputSchema: getPeopleBySpaceSlugInputSchema,
    outputSchema: getPeopleBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getPeopleBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const { space_slug, page, page_size, searchTerm } = parsed.data;

    const host = await findSpaceBySlug({ slug: space_slug }, { db });
    if (host) {
      const authToken = process.env.HYPHA_MCP_AUTH_TOKEN;
      const access = await checkSpaceAccessForSpace(host, authToken);
      if (!access.hasAccess) {
        return {
          content: [
            {
              type: 'text',
              text: access.message,
            },
          ],
          isError: true,
        };
      }
    }

    const raw = await getSpaceMembersRoster(
      {
        spaceSlug: space_slug,
        page,
        pageSize: page_size,
        searchTerm,
      },
      { db },
    );

    const structured = serializeSpaceMembersRosterDatesForJson(raw);
    const outParse = getPeopleBySpaceSlugOutputSchema.safeParse(structured);
    if (!outParse.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Internal error: output validation failed: ${outParse.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const peopleCount = structured.found
      ? structured.members.filter((m) => m.member_kind === 'person').length
      : 0;
    const spaceCount = structured.found
      ? structured.members.filter((m) => m.member_kind === 'space').length
      : 0;

    const summary = structured.found
      ? `Space "${structured.space_slug}": page ${
          structured.pagination.page
        }/${Math.max(
          structured.pagination.total_pages,
          1,
        )} — ${peopleCount} people, ${spaceCount} space members on this page (total ${
          structured.pagination.total
        }).`
      : `No space found for slug "${structured.space_slug}".`;

    return {
      content: [{ type: 'text', text: summary }],
      structuredContent: outParse.data,
    };
  },
);

server.registerTool(
  'get_org_memory_by_space_slug',
  {
    description:
      'Read-only: organisation memory for a space by slug — same member roster as get_people_by_space_slug plus org_memory_assets (proposal attachments and lead images from documents; Matrix m.file/m.image when NEXT_PUBLIC_MATRIX_HOMESERVER_URL and chat_room_id are set, and either HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN or HYPHA_MCP_AUTH_TOKEN + HYPHA_MCP_MATRIX_REQUEST_URL / VERCEL_URL for session Matrix token resolution). structuredContent matrix_fetch includes used_bot_access_token, used_session_matrix_token, session_matrix_token_unavailable, skipped_reason, http_status, events_in_chunk, media_events_yielded, error. Optional assets_page, assets_page_size, assets_search paginate/filter assets separately from the roster.',
    inputSchema: getOrgMemoryBySpaceSlugInputSchema,
    outputSchema: getOrgMemoryBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getOrgMemoryBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const {
      space_slug,
      page,
      page_size,
      searchTerm,
      assets_page,
      assets_page_size,
      assets_search,
    } = parsed.data;

    const mcpMatrixRequestUrl =
      process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
      (process.env.VERCEL_URL?.trim()
        ? `https://${process.env.VERCEL_URL.trim()}`
        : undefined);

    try {
      const gated = await getOrgMemoryBySpaceSlug(
        {
          spaceSlug: space_slug,
          page,
          pageSize: page_size,
          searchTerm,
          assetsPage: assets_page,
          assetsPageSize: assets_page_size,
          assetsSearch: assets_search,
          requestUrlForSessionMatrix: mcpMatrixRequestUrl,
        },
        { db, authToken: process.env.HYPHA_MCP_AUTH_TOKEN },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = getOrgMemoryBySpaceSlugOutputSchema.safeParse(
        gated.result,
      );
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const structured = outParse.data;
      const peopleCount = structured.found
        ? structured.members.filter((m) => m.member_kind === 'person').length
        : 0;
      const spaceCount = structured.found
        ? structured.members.filter((m) => m.member_kind === 'space').length
        : 0;
      const assetCount = structured.found
        ? structured.org_memory_assets.length
        : 0;

      const mf = structured.found ? structured.matrix_fetch : null;
      const matrixHint =
        mf && mf.media_events_yielded === 0
          ? ` Matrix: ${
              mf.attempted
                ? `attempted (HTTP ${mf.http_status ?? 'n/a'}, events ${
                    mf.events_in_chunk
                  })`
                : 'not attempted'
            }${mf.skipped_reason ? ` — ${mf.skipped_reason}` : ''}${
              mf.used_session_matrix_token ? ' — used_session_matrix_token' : ''
            }${
              mf.session_matrix_token_unavailable
                ? ' — session_matrix_token_unavailable (Human Chat Matrix link missing or expired)'
                : ''
            }${
              mf.skipped_reason === 'missing_access_token' &&
              !mf.used_session_matrix_token &&
              !mf.session_matrix_token_unavailable
                ? ' — set HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN (bot) or pass Privy JWT + app URL for per-user Matrix (Hypha Chat / MCP)'
                : ''
            }${mf.error ? ` — ${mf.error}` : ''}.`
          : '';

      const summary = structured.found
        ? `Space "${structured.space_slug}": roster page ${
            structured.pagination.page
          }/${Math.max(
            structured.pagination.total_pages,
            1,
          )} — ${peopleCount} people, ${spaceCount} space members (total members ${
            structured.pagination.total
          }); assets page ${structured.assets_pagination.page}/${Math.max(
            structured.assets_pagination.total_pages,
            1,
          )} — ${assetCount} asset(s) on this page (total assets ${
            structured.assets_pagination.total
          }).${matrixHint}`
        : `No space found for slug "${structured.space_slug}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: structured,
      };
    } catch (err) {
      console.error('[hypha-mcp:get_org_memory_by_space_slug] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching org memory',
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  'get_documents_by_space_slug',
  {
    description:
      'Read-only: list documents in a Hypha space by slug (DB documents table: title, state, slug, label, web3 proposal id, attachments, creator summary, timestamps). Supports full-text search on title/description and optional state filter. Same access rules as member roster for non-public spaces.',
    inputSchema: getDocumentsBySpaceSlugInputSchema,
    outputSchema: getDocumentsBySpaceSlugOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  async (args) => {
    const parsed = getDocumentsBySpaceSlugInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Invalid input: ${parsed.error.message}`,
          },
        ],
        isError: true,
      };
    }

    const { space_slug, page, page_size, searchTerm, state } = parsed.data;

    try {
      const gated = await getDocumentsBySpaceSlug(
        {
          spaceSlug: space_slug,
          page,
          pageSize: page_size,
          searchTerm,
          state,
        },
        { db, authToken: process.env.HYPHA_MCP_AUTH_TOKEN },
      );

      if (gated.access === 'denied') {
        return {
          content: [{ type: 'text', text: gated.message }],
          isError: true,
        };
      }

      const outParse = getDocumentsBySpaceSlugOutputSchema.safeParse(
        gated.result,
      );
      if (!outParse.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Internal error: output validation failed: ${outParse.error.message}`,
            },
          ],
          isError: true,
        };
      }

      const structured = outParse.data;
      const summary = structured.found
        ? `Space "${structured.space_slug}": page ${
            structured.pagination.page
          }/${Math.max(structured.pagination.total_pages, 1)} — ${
            structured.documents.length
          } documents (total ${structured.pagination.total}).`
        : `No space found for slug "${structured.space_slug}".`;

      return {
        content: [{ type: 'text', text: summary }],
        structuredContent: structured,
      };
    } catch (err) {
      console.error('[hypha-mcp:get_documents_by_space_slug] failed', err);
      return {
        content: [
          {
            type: 'text',
            text: 'Internal error while fetching documents',
          },
        ],
        isError: true,
      };
    }
  },
);

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[hypha-mcp] Unhandled rejection:', reason);
  process.exit(1);
});
process.on('uncaughtException', (err: unknown) => {
  console.error('[hypha-mcp] Uncaught exception:', err);
  process.exit(1);
});

const transport = new StdioServerTransport();
server.connect(transport).catch((err: unknown) => {
  console.error('[hypha-mcp] Failed to start:', err);
  process.exit(1);
});
