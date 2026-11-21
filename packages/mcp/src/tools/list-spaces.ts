import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { ERRORS, TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { presentSpace, spaceItemSchema } from '../presentation/spaces';
import { decodeCursor, encodeCursor } from './cursor';
import { failureText, runTool } from './run-tool';

export { decodeCursor, encodeCursor };

const P = TOOLS.hypha_list_spaces.params;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export const listSpacesInput = z.object({
  query: z.string().trim().min(1).max(200).optional().describe(P.query),
  parentOnly: z.boolean().optional().describe(P.parentOnly),
  omitSandbox: z.boolean().optional().describe(P.omitSandbox),
  includeArchived: z.boolean().optional().describe(P.includeArchived),
  includeEmpty: z.boolean().optional().describe(P.includeEmpty),
  include: z
    .array(z.enum(['visibility']))
    .max(1)
    .optional()
    .describe(P.include),
  order: z
    .array(
      z.object({
        field: z.enum(['title']),
        direction: z.enum(['asc', 'desc']),
      }),
    )
    .max(1)
    .optional()
    .describe(P.order),
  cursor: z.string().max(200).optional().describe(P.cursor),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(P.pageSize),
});

export const listSpacesOutput = z.object({
  items: z.array(spaceItemSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  showing: z.number(),
  total: z.number(),
  asOf: z.string(),
});

export function registerListSpaces(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_list_spaces',
    {
      title: TOOLS.hypha_list_spaces.title,
      description: TOOLS.hypha_list_spaces.description,
      inputSchema: listSpacesInput,
      outputSchema: listSpacesOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_list_spaces', async (caller) => {
        const offset = decodeCursor(args.cursor);
        if (offset === null) {
          return {
            ok: false,
            text: ERRORS.invalidCursor,
            outcome: 'bad_input',
          };
        }
        const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
        const withVisibility = args.include?.includes('visibility') ?? false;

        const r = await deps.features.listSpaces(
          {
            search: args.query,
            parentOnly: args.parentOnly ?? false,
            omitSandbox: args.omitSandbox ?? false,
            // Archived is the flag only; empty spaces have their own switch (includeEmpty).
            omitFlagArchived: !(args.includeArchived ?? false),
            omitEmpty: !(args.includeEmpty ?? false),
            titleOrder: args.order?.[0]?.direction ?? 'asc',
            paging: { offset, limit: pageSize },
            with: { governance: true, visibility: withVisibility },
          },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const { data } = r;
        const items = data.items.map((space) =>
          presentSpace(space, {
            spaceUrl: deps.spaceUrl,
            data,
            withVisibility,
          }),
        );
        const hasMore = offset + pageSize < data.total;
        return {
          ok: true,
          itemCount: items.length,
          result: {
            items,
            hasMore,
            nextCursor: hasMore ? encodeCursor(offset + pageSize) : null,
            showing: items.length,
            total: data.total,
            asOf: data.asOf,
          },
        };
      }),
  );
}
