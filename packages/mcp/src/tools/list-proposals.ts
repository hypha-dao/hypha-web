import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { ERRORS, TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import { presentProposal, proposalItemSchema } from '../presentation/proposals';
import { decodeCursor, encodeCursor } from './cursor';
import { failureText, runTool } from './run-tool';

const P = TOOLS.hypha_list_proposals.params;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export const listProposalsInput = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(P.spaceSlug),
  state: z.enum(['proposal', 'agreement', 'both']).optional().describe(P.state),
  query: z.string().trim().min(1).max(200).optional().describe(P.query),
  includeTally: z.boolean().optional().describe(P.includeTally),
  order: z
    .array(
      z.object({
        field: z.enum(['createdAt']),
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

export const listProposalsOutput = z.object({
  items: z.array(proposalItemSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  showing: z.number(),
  total: z.number(),
  asOf: z.string(),
});

export function registerListProposals(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_list_proposals',
    {
      title: TOOLS.hypha_list_proposals.title,
      description: TOOLS.hypha_list_proposals.description,
      inputSchema: listProposalsInput,
      outputSchema: listProposalsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_list_proposals', async (caller) => {
        const offset = decodeCursor(args.cursor);
        if (offset === null) {
          return {
            ok: false,
            text: ERRORS.invalidCursor,
            outcome: 'bad_input',
          };
        }
        const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;

        const r = await deps.features.listProposals(
          {
            spaceSlug: args.spaceSlug,
            state: args.state ?? 'both',
            searchTerm: args.query,
            direction: args.order?.[0]?.direction ?? 'desc',
            paging: { offset, limit: pageSize },
            with: { tally: args.includeTally ?? false },
          },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const { data } = r;
        const items = data.items.map((item) =>
          presentProposal(item, {
            proposalUrl: (slug) => deps.proposalUrl(args.spaceSlug, slug),
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
