import 'server-only';

import type { ReadCtx } from '../../data-access/types';
import {
  countSignals,
  readSignalWorkflowConfig,
  selectPersonDisplayNames,
  selectSignalUpvotes,
  selectSignalsPage,
  selectTokenSymbolsByAddress,
  selectTopSignalTags,
  summariseSignals,
} from '../../data-access/signals';
import { findSpaceHostFieldsBySlug } from '../../data-access/spaces';
import { failure, type Failure } from '../../access/failure';
import { decideSpaceAccess } from '../../access/policy';
import { COHERENCE_PRIORITIES } from '../../coherence/coherence-priorities';
import { COHERENCE_TYPES } from '../../coherence/coherence-types';
import type {
  SignalFilter,
  SignalOrder,
  SignalRow,
  SignalWorkflowView,
} from '../../coherence/server/list-signals-queries';
import {
  normalizeAssigneeIds,
  resolveDefaultBoard,
  type SignalWorkflowConfig,
} from '../../coherence/signal-workflow';
import { parseCapitalKeys, type CapitalKey } from '../../network/capitals';
import { originViewFromColumns, type OriginView } from '../../origin';

export type ListSignalsInput = {
  spaceSlug: string;
  /** Match on title and description. */
  query?: string;
  type?: (typeof COHERENCE_TYPES)[number];
  priority?: (typeof COHERENCE_PRIORITIES)[number];
  /** A signal matches when it carries any of these tags. */
  tags?: string[];
  createdByMe?: boolean;
  includeArchived?: boolean;
  /** Only signals created or changed at or after this instant. */
  updatedSince?: Date;
  /** Default `mostrecent` (by creation). */
  order?: SignalOrder;
  paging: { offset: number; limit: number };
  /** How much description text to read. */
  description?: 'none' | 'excerpt' | 'full';
  /** Default true. Counts over the whole filtered set. */
  withSummary?: boolean;
  /** The task-like group (legacy): filters on fields from when signals doubled as tasks. */
  legacy?: {
    status?: string;
    board?: string;
    assignedToMe?: boolean;
    overdue?: boolean;
  };
};

export type SignalItem = {
  slug: string;
  title: string;
  /** As written (a prefix when the mode is `excerpt`), or `null` in mode `none`. */
  description: string | null;
  type: (typeof COHERENCE_TYPES)[number];
  priority: (typeof COHERENCE_PRIORITIES)[number];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
  messageCount: number;
  capitals: CapitalKey[];
  /** Amounts that name the ask or resource. They move no funds. */
  indicativePayouts: { amount: string; tokenSymbol: string | null }[];
  upvotes: {
    upCount: number;
    downCount: number;
    /** Net raw voting power (up minus down), as stored. */
    totalVotingPower: string;
    votingPowerDecimals: number;
  };
  viewer: { isCreator: boolean; vote: 'up' | 'down' | null };
  /** Display name only: never an address or a person id. */
  creatorName: string | null;
  /**
   * Which path created the signal (#2724): the kind and the client's self-declared name, never
   * the client id. `unknown` for signals written before origin was recorded.
   */
  origin: OriginView;
  /** From when signals doubled as tasks; kept for the migration period. */
  taskFields: {
    status: string;
    statusCategory: string | null;
    board: string;
    assignees: string[];
    dueAt: Date | null;
    /** `dueAt` is before now (a strict instant). */
    overdue: boolean;
  };
};

export type SignalsSummary = {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  topTags: { tag: string; count: number }[];
  /** Counts of the task-like fields, kept apart on purpose. */
  legacy: {
    byStatus: {
      status: string;
      name: string | null;
      category: string | null;
      count: number;
    }[];
    byBoard: { board: string; name: string | null; count: number }[];
    overdue: number;
    unassigned: number;
  };
};

export type ListSignalsData = {
  items: SignalItem[];
  /** All the signals the caller may see in this space that match the filters, before paging. */
  total: number;
  summary: SignalsSummary | null;
  asOf: string;
};

const EXCERPT_READ_CHARS = 1_200;
const TOP_TAGS = 10;

function workflowView(config: SignalWorkflowConfig): SignalWorkflowView {
  return {
    boardSlugs: config.boards
      .filter((board) => !board.archived)
      .map((board) => board.slug),
    defaultBoard: resolveDefaultBoard(config),
  };
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function asPayouts(value: unknown): { amount: string; token: string }[] {
  if (!Array.isArray(value)) return [];
  const rows: { amount: string; token: string }[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const amount = String((row as { amount?: unknown }).amount ?? '').trim();
    const token = String((row as { token?: unknown }).token ?? '').trim();
    if (amount && token) rows.push({ amount, token });
  }
  return rows;
}

/**
 * Feature function "list signals": the signals of one space. A signal enters a space and
 * signifies something; it commits nobody (K92). The access policy runs first on the light
 * host lookup; every query then carries that one space id, so a row of another space (a
 * network-shared signal included) cannot come back. Filtering, ordering, paging and the
 * summary happen in the database, and the summary runs over the whole filtered set, after
 * the policy and before paging. Any failed read fails the call: there is no partial result.
 */
export async function listSignals(
  input: ListSignalsInput,
  ctx: ReadCtx,
): Promise<{ ok: true; data: ListSignalsData } | Failure> {
  try {
    const host = await findSpaceHostFieldsBySlug(ctx, {
      slug: input.spaceSlug,
    });
    if (!host) return failure('not_found', 'Space not found');

    const decision = await decideSpaceAccess(host, ctx);
    if (decision.outcome === 'none') {
      return decision.failure.code === 'access_check_failed'
        ? decision.failure
        : failure('not_found', 'Space not found');
    }

    const caller = ctx.actor;
    const personId = caller.kind === 'user' ? caller.person.id : null;
    if (
      (input.createdByMe || input.legacy?.assignedToMe) &&
      personId === null
    ) {
      return failure('unauthenticated', 'This needs a signed-in user.');
    }

    const config = await readSignalWorkflowConfig(ctx, { spaceId: host.id });
    const workflow = workflowView(config);
    const categoryOf = new Map(
      config.statuses.map((status) => [status.slug, status.category]),
    );
    const statusName = new Map(
      config.statuses.map((status) => [status.slug, status.name]),
    );
    const boardName = new Map(
      config.boards.map((board) => [board.slug, board.name]),
    );

    const filter: SignalFilter = {
      spaceId: host.id,
      query: input.query,
      type: input.type,
      priority: input.priority,
      tags: input.tags,
      createdByPersonId: input.createdByMe ? personId ?? undefined : undefined,
      includeArchived: input.includeArchived ?? false,
      updatedSince: input.updatedSince,
      legacy: input.legacy
        ? {
            status: input.legacy.status,
            board: input.legacy.board,
            assignedToPersonId: input.legacy.assignedToMe
              ? personId ?? undefined
              : undefined,
            overdue: input.legacy.overdue,
          }
        : undefined,
    };

    const mode = input.description ?? 'excerpt';
    const limit = Math.min(Math.max(Math.trunc(input.paging.limit), 1), 100);
    const offset = Math.max(Math.trunc(input.paging.offset), 0);
    const wantsSummary = input.withSummary !== false;

    const [rows, counts, topTags] = await Promise.all([
      selectSignalsPage(ctx, {
        filter,
        workflow,
        order: input.order ?? 'mostrecent',
        offset,
        limit,
        descriptionChars:
          mode === 'none' ? null : mode === 'full' ? 'all' : EXCERPT_READ_CHARS,
      }),
      wantsSummary
        ? summariseSignals(ctx, filter, workflow)
        : countSignals(ctx, filter, workflow),
      wantsSummary
        ? selectTopSignalTags(ctx, filter, workflow, TOP_TAGS)
        : Promise.resolve([]),
    ]);

    const total = typeof counts === 'number' ? counts : counts.total;
    const assigneeIds = new Map<number, number[]>();
    const payoutsByRow = new Map<number, { amount: string; token: string }[]>();
    for (const row of rows) {
      assigneeIds.set(row.id, normalizeAssigneeIds(row.assigneeIds));
      payoutsByRow.set(row.id, asPayouts(row.indicativePayouts));
    }
    const allAssignees = [...new Set([...assigneeIds.values()].flat())];
    const allTokens = [
      ...new Set([...payoutsByRow.values()].flat().map((p) => p.token)),
    ];
    const [upvotes, names, symbols] = await Promise.all([
      selectSignalUpvotes(
        ctx,
        rows.map((row) => row.id),
        personId,
      ),
      selectPersonDisplayNames(ctx, allAssignees),
      selectTokenSymbolsByAddress(ctx, allTokens),
    ]);

    const toItem = (row: SignalRow): SignalItem => {
      const vote = upvotes.get(row.id);
      return {
        slug: row.slug,
        title: row.title,
        description: row.description,
        type: row.type as SignalItem['type'],
        priority: row.priority as SignalItem['priority'],
        tags: asTags(row.tags),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
        archived: row.archived,
        messageCount: row.messages,
        capitals: parseCapitalKeys(row.capitals),
        indicativePayouts: (payoutsByRow.get(row.id) ?? []).map((payout) => ({
          amount: payout.amount,
          tokenSymbol: symbols.get(payout.token.toLowerCase()) ?? null,
        })),
        upvotes: {
          upCount: vote?.upCount ?? 0,
          downCount: vote?.downCount ?? 0,
          totalVotingPower: vote?.totalVotingPower ?? '0',
          votingPowerDecimals: vote?.tokenDecimals ?? 0,
        },
        viewer: {
          isCreator: personId !== null && row.creatorId === personId,
          vote: vote?.myDirection ?? null,
        },
        creatorName: row.creatorName,
        origin: originViewFromColumns(row),
        taskFields: {
          status: row.status,
          statusCategory: categoryOf.get(row.status) ?? null,
          board: row.board,
          assignees: (assigneeIds.get(row.id) ?? [])
            .map((id) => names.get(id))
            .filter((name): name is string => name !== undefined),
          dueAt: row.dueAt ? new Date(row.dueAt) : null,
          overdue: row.overdue,
        },
      };
    };

    let summary: SignalsSummary | null = null;
    if (typeof counts !== 'number') {
      summary = {
        total: counts.total,
        byType: Object.fromEntries(
          COHERENCE_TYPES.map((type) => [type, counts.byType.get(type) ?? 0]),
        ),
        byPriority: Object.fromEntries(
          COHERENCE_PRIORITIES.map((priority) => [
            priority,
            counts.byPriority.get(priority) ?? 0,
          ]),
        ),
        topTags,
        legacy: {
          byStatus: [...counts.byStatus.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([status, count]) => ({
              status,
              name: statusName.get(status) ?? null,
              category: categoryOf.get(status) ?? null,
              count,
            })),
          byBoard: [...counts.byBoard.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .map(([board, count]) => ({
              board,
              name: boardName.get(board) ?? null,
              count,
            })),
          overdue: counts.overdue,
          unassigned: counts.unassigned,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: rows.map(toItem),
        total,
        summary,
        asOf: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('[features] list signals failed', error);
    return failure(
      'access_check_failed',
      'Signals could not be listed right now.',
    );
  }
}
