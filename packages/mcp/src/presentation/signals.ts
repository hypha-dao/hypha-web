import { z } from 'zod';
import type { SignalItem, SignalsSummary } from '@hypha-platform/core/server';
import { TOOLS } from '../descriptions';
import { sanitiseUserText } from '../sanitiser';
import { userText } from './user-text';
import { originSchema, presentOrigin } from './origin';

export const SIGNAL_TYPES = [
  'Need',
  'Resource',
  'Opportunity',
  'Insight',
  'Tension',
  'Risk',
  'Action',
  'Impact',
  'Bug',
  'Trend',
  'Proposal',
] as const;
export const SIGNAL_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const SIGNAL_ORDERS = [
  'mostrecent',
  'mostupvoted',
  'mostmessages',
] as const;
export type SignalDescriptionMode = 'none' | 'excerpt' | 'full';

export const SIGNAL_TEXT_CAPS = {
  title: 200,
  creatorName: 200,
  /** About 500 characters: the default view of a description. */
  descriptionExcerpt: 500,
  /** The creation limit is 4,000 characters. */
  descriptionFull: 4_000,
  tag: 60,
  slugLike: 64,
  name: 200,
  amount: 40,
  symbol: 24,
} as const;

type UserTextKey = 'title' | 'description' | 'creatorName';

/** A short user-written string (a tag, a name, a symbol): sanitised and capped. */
const clean = (value: string, max: number): string =>
  sanitiseUserText(value, max).text;
const cleanOrNull = (value: string | null, max: number): string | null =>
  value === null ? null : clean(value, max);

const countMap = z.record(z.string(), z.number());

export const signalItemSchema = z.object({
  slug: z.string(),
  url: z.string(),
  type: z.enum(SIGNAL_TYPES),
  priority: z.enum(SIGNAL_PRIORITIES),
  /** Tags as stored, sanitised like any user text. */
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
  messageCount: z.number(),
  capitals: z.array(z.string()),
  indicativePayouts: z.array(
    z.object({ amount: z.string(), tokenSymbol: z.string().nullable() }),
  ),
  upvotes: z.object({
    upCount: z.number(),
    downCount: z.number(),
    totalVotingPower: z.string(),
    votingPowerDecimals: z.number(),
  }),
  viewer: z.object({
    isCreator: z.boolean(),
    vote: z.enum(['up', 'down']).nullable(),
  }),
  origin: originSchema.describe(TOOLS.hypha_list_signals.fields.origin),
  userText: z.object({
    title: z.string().nullable(),
    /** Absent when `description` is `none`. */
    description: z.string().nullable().optional(),
    creatorName: z.string().nullable(),
    truncated: z.array(z.enum(['title', 'description', 'creatorName'])),
  }),
  taskFields: z
    .object({
      status: z.string(),
      statusCategory: z.string().nullable(),
      board: z.string(),
      assignees: z.array(z.string()),
      dueAt: z.string().nullable(),
      overdue: z.boolean(),
    })
    .describe(TOOLS.hypha_list_signals.fields.taskFields),
});
export type SignalPresented = z.infer<typeof signalItemSchema>;

export const signalsSummarySchema = z.object({
  total: z.number(),
  byType: countMap,
  byPriority: countMap,
  topTags: z.array(z.object({ tag: z.string(), count: z.number() })),
  legacy: z
    .object({
      byStatus: z.array(
        z.object({
          status: z.string(),
          name: z.string().nullable(),
          category: z.string().nullable(),
          count: z.number(),
        }),
      ),
      byBoard: z.array(
        z.object({
          board: z.string(),
          name: z.string().nullable(),
          count: z.number(),
        }),
      ),
      overdue: z.number(),
      unassigned: z.number(),
    })
    .describe(TOOLS.hypha_list_signals.fields.legacySummary),
});

/**
 * MCP's own presentation model over a feature function's signal. Titles, descriptions, the
 * creator's display name, tags and every other text a person wrote are sanitised and capped;
 * no person id, address or avatar is part of the model.
 */
export function presentSignal(
  item: SignalItem,
  ctx: { url: string; description: SignalDescriptionMode },
): SignalPresented {
  const out: SignalPresented = {
    slug: item.slug,
    url: ctx.url,
    type: item.type,
    priority: item.priority,
    tags: item.tags.map((tag) => clean(tag, SIGNAL_TEXT_CAPS.tag)),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    archived: item.archived,
    messageCount: item.messageCount,
    capitals: item.capitals,
    indicativePayouts: item.indicativePayouts.map((payout) => ({
      amount: clean(payout.amount, SIGNAL_TEXT_CAPS.amount),
      tokenSymbol: cleanOrNull(payout.tokenSymbol, SIGNAL_TEXT_CAPS.symbol),
    })),
    upvotes: item.upvotes,
    viewer: item.viewer,
    origin: presentOrigin(item.origin),
    userText: userText<UserTextKey>({
      title: { value: item.title, max: SIGNAL_TEXT_CAPS.title },
      description: {
        atWordBoundary: true,
        value: ctx.description === 'none' ? null : item.description,
        max:
          ctx.description === 'full'
            ? SIGNAL_TEXT_CAPS.descriptionFull
            : SIGNAL_TEXT_CAPS.descriptionExcerpt,
      },
      creatorName: {
        value: item.creatorName,
        max: SIGNAL_TEXT_CAPS.creatorName,
      },
    }),
    taskFields: {
      status: clean(item.taskFields.status, SIGNAL_TEXT_CAPS.slugLike),
      statusCategory: item.taskFields.statusCategory,
      board: clean(item.taskFields.board, SIGNAL_TEXT_CAPS.slugLike),
      assignees: item.taskFields.assignees.map((name) =>
        clean(name, SIGNAL_TEXT_CAPS.name),
      ),
      dueAt: item.taskFields.dueAt ? item.taskFields.dueAt.toISOString() : null,
      overdue: item.taskFields.overdue,
    },
  };
  if (ctx.description === 'none') delete out.userText.description;
  return out;
}

export function presentSignalsSummary(
  summary: SignalsSummary,
): z.infer<typeof signalsSummarySchema> {
  return {
    total: summary.total,
    byType: summary.byType,
    byPriority: summary.byPriority,
    topTags: summary.topTags.map((entry) => ({
      tag: clean(entry.tag, SIGNAL_TEXT_CAPS.tag),
      count: entry.count,
    })),
    legacy: {
      byStatus: summary.legacy.byStatus.map((entry) => ({
        status: clean(entry.status, SIGNAL_TEXT_CAPS.slugLike),
        name: cleanOrNull(entry.name, SIGNAL_TEXT_CAPS.name),
        category: entry.category,
        count: entry.count,
      })),
      byBoard: summary.legacy.byBoard.map((entry) => ({
        board: clean(entry.board, SIGNAL_TEXT_CAPS.slugLike),
        name: cleanOrNull(entry.name, SIGNAL_TEXT_CAPS.name),
        count: entry.count,
      })),
      overdue: summary.legacy.overdue,
      unassigned: summary.legacy.unassigned,
    },
  };
}
