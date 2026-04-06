import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { db } from '@hypha-platform/storage-postgres';
import { getSpaceMembersRoster } from '@hypha-platform/core/server';
import {
  getPeopleBySpaceSlugInputSchema,
  getPeopleBySpaceSlugOutputSchema,
} from './get-people-by-space-slug-schema.js';

function serializeRosterForJson(
  result: Awaited<ReturnType<typeof getSpaceMembersRoster>>,
) {
  if (!result.found) {
    return result;
  }

  return {
    ...result,
    members: result.members.map((entry) => {
      if (entry.member_kind === 'person') {
        return {
          ...entry,
          person: {
            ...entry.person,
            createdAt: entry.person.createdAt.toISOString(),
            updatedAt: entry.person.updatedAt.toISOString(),
          },
        };
      }
      return {
        ...entry,
        space: {
          ...entry.space,
          createdAt: entry.space.createdAt.toISOString(),
          updatedAt: entry.space.updatedAt.toISOString(),
        },
      };
    }),
  };
}

const server = new McpServer(
  {
    name: 'hypha-mcp',
    version: '0.0.0',
  },
  {
    instructions:
      'Hypha read-only tools: space members (people and spaces-as-members) by space slug.',
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
    const raw = await getSpaceMembersRoster(
      {
        spaceSlug: space_slug,
        page,
        pageSize: page_size,
        searchTerm,
      },
      { db },
    );

    const structured = serializeRosterForJson(raw);
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

const transport = new StdioServerTransport();
await server.connect(transport);
