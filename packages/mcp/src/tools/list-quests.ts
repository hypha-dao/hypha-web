import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { ERRORS, TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import {
  presentQuest,
  QUEST_STATUSES,
  questCountsSchema,
  questItemSchema,
} from '../presentation/quests';
import { decodeCursor, encodeCursor } from './cursor';
import { failureText, runTool } from './run-tool';

const P = TOOLS.hypha_list_quests.params;
const MAX_PAGE_SIZE = 20;
const DEFAULT_PAGE_SIZE = 10;
/** Full texts are long, so a page holds at most this many quests. */
const FULL_TEXT_MAX_PAGE_SIZE = 5;

export const listQuestsInput = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(P.spaceSlug),
  status: z.enum(QUEST_STATUSES).optional().describe(P.status),
  mine: z.boolean().optional().describe(P.mine),
  includeArchived: z.boolean().optional().describe(P.includeArchived),
  includeProposalStatus: z
    .boolean()
    .optional()
    .describe(P.includeProposalStatus),
  text: z.enum(['none', 'excerpt', 'full']).optional().describe(P.text),
  cursor: z.string().max(200).optional().describe(P.cursor),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(P.pageSize),
});

export const listQuestsOutput = z.object({
  items: z.array(questItemSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  showing: z.number(),
  total: z.number(),
  counts: questCountsSchema,
  asOf: z.string(),
});

export function registerListQuests(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_list_quests',
    {
      title: TOOLS.hypha_list_quests.title,
      description: TOOLS.hypha_list_quests.description,
      inputSchema: listQuestsInput,
      outputSchema: listQuestsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_list_quests', async (caller) => {
        const offset = decodeCursor(args.cursor);
        if (offset === null) {
          return {
            ok: false,
            text: ERRORS.invalidCursor,
            outcome: 'bad_input',
          };
        }
        const text = args.text ?? 'excerpt';
        const pageSize = Math.min(
          args.pageSize ?? DEFAULT_PAGE_SIZE,
          text === 'full' ? FULL_TEXT_MAX_PAGE_SIZE : MAX_PAGE_SIZE,
        );

        const r = await deps.features.listQuests(
          {
            spaceSlug: args.spaceSlug,
            status: args.status,
            mine: args.mine ?? false,
            includeArchived: args.includeArchived ?? false,
            includeProposalStatus: args.includeProposalStatus ?? false,
            paging: { offset, limit: pageSize },
          },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const { data } = r;
        const items = data.items.map((item) =>
          presentQuest(item, {
            url: deps.questUrl(args.spaceSlug, item.slug),
            proposalUrl: (slug) => deps.proposalUrl(args.spaceSlug, slug),
            text,
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
            counts: data.counts,
            asOf: data.asOf,
          },
        };
      }),
  );
}
