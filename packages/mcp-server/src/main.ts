import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  findSpaceBySlug,
  getDocumentsBySpaceSlug,
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

const server = new McpServer(
  {
    name: 'hypha-mcp',
    version: '0.0.0',
  },
  {
    instructions:
      'Hypha read-only tools: space members by slug; documents (proposals/discussions/agreements) in a space by slug.',
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
