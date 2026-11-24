import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { ERRORS, TOOLS } from '../descriptions';
import type { McpDeps } from '../deps';
import {
  presentSignal,
  presentSignalsSummary,
  SIGNAL_ORDERS,
  SIGNAL_PRIORITIES,
  SIGNAL_TYPES,
  signalItemSchema,
  signalsSummarySchema,
} from '../presentation/signals';
import { decodeCursor, encodeCursor } from './cursor';
import { failureText, runTool } from './run-tool';

const P = TOOLS.hypha_list_signals.params;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;
/** Full descriptions are long, so a page holds at most this many items. */
const FULL_DESCRIPTION_MAX_PAGE_SIZE = 10;

export const listSignalsInput = z.object({
  spaceSlug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
    .describe(P.spaceSlug),
  query: z.string().trim().min(1).max(200).optional().describe(P.query),
  type: z.enum(SIGNAL_TYPES).optional().describe(P.type),
  priority: z.enum(SIGNAL_PRIORITIES).optional().describe(P.priority),
  tags: z
    .array(z.string().trim().min(1).max(60))
    .min(1)
    .max(10)
    .optional()
    .describe(P.tags),
  createdByMe: z.boolean().optional().describe(P.createdByMe),
  includeArchived: z.boolean().optional().describe(P.includeArchived),
  updatedSince: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(P.updatedSince),
  order: z.enum(SIGNAL_ORDERS).optional().describe(P.order),
  description: z
    .enum(['none', 'excerpt', 'full'])
    .optional()
    .describe(P.description),
  omitSummary: z.boolean().optional().describe(P.omitSummary),
  status: z.string().trim().min(1).max(64).optional().describe(P.status),
  board: z.string().trim().min(1).max(64).optional().describe(P.board),
  assignedToMe: z.boolean().optional().describe(P.assignedToMe),
  overdue: z.boolean().optional().describe(P.overdue),
  cursor: z.string().max(200).optional().describe(P.cursor),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(P.pageSize),
});

export const listSignalsOutput = z.object({
  items: z.array(signalItemSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  showing: z.number(),
  total: z.number(),
  asOf: z.string(),
  /** Absent when `omitSummary` is set. */
  summary: signalsSummarySchema.optional(),
});

export function registerListSignals(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    'hypha_list_signals',
    {
      title: TOOLS.hypha_list_signals.title,
      description: TOOLS.hypha_list_signals.description,
      inputSchema: listSignalsInput,
      outputSchema: listSignalsOutput,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args) =>
      runTool(deps, 'hypha_list_signals', async (caller) => {
        const offset = decodeCursor(args.cursor);
        if (offset === null) {
          return {
            ok: false,
            text: ERRORS.invalidCursor,
            outcome: 'bad_input',
          };
        }
        const description = args.description ?? 'excerpt';
        const pageSize = Math.min(
          args.pageSize ?? DEFAULT_PAGE_SIZE,
          description === 'full'
            ? FULL_DESCRIPTION_MAX_PAGE_SIZE
            : MAX_PAGE_SIZE,
        );

        const r = await deps.features.listSignals(
          {
            spaceSlug: args.spaceSlug,
            query: args.query,
            type: args.type,
            priority: args.priority,
            tags: args.tags,
            createdByMe: args.createdByMe ?? false,
            includeArchived: args.includeArchived ?? false,
            updatedSince: args.updatedSince
              ? new Date(args.updatedSince)
              : undefined,
            order: args.order ?? 'mostrecent',
            paging: { offset, limit: pageSize },
            description,
            withSummary: !(args.omitSummary ?? false),
            legacy: {
              status: args.status,
              board: args.board,
              assignedToMe: args.assignedToMe ?? false,
              overdue: args.overdue ?? false,
            },
          },
          caller,
        );
        if (!r.ok) {
          return { ok: false, text: failureText(r), outcome: r.code };
        }
        const { data } = r;
        const items = data.items.map((item) =>
          presentSignal(item, {
            url: deps.signalUrl(args.spaceSlug, item.slug),
            description,
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
            ...(data.summary
              ? { summary: presentSignalsSummary(data.summary) }
              : {}),
          },
        };
      }),
  );
}
