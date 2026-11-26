import { sql, type SQL } from 'drizzle-orm';

import type { DbConfig } from '../../common/server/types';
import { COHERENCE_PRIORITIES } from '../coherence-priorities';
import { COHERENCE_TYPES } from '../coherence-types';
import { DEFAULT_SIGNAL_PROGRESS_STATUS } from '../signal-workflow';

/**
 * Read queries of the signals list for the MCP feature function. Everything the list needs
 * (filtering, ordering, paging, counts) is done by the database; no query here loads a whole
 * board. Every query is scoped to ONE space id that the caller of this module has already
 * checked with the access policy, and nothing here takes an id from the end user.
 *
 * Stored values are normalised in SQL the way the signals page shows them: an unknown type
 * reads as `Opportunity`, an unknown priority as `medium`, an empty status as the default
 * status, an empty or unknown board as the space's default board.
 */

export type SignalWorkflowView = {
  /** Slugs of the boards that are not archived. */
  boardSlugs: string[];
  defaultBoard: string;
};

export type SignalFilter = {
  spaceId: number;
  /** Case-insensitive match on title and description (substring or word match). */
  query?: string;
  type?: string;
  priority?: string;
  /** A signal matches when it carries ANY of these tags (case-insensitive). */
  tags?: string[];
  createdByPersonId?: number;
  includeArchived?: boolean;
  /** Only signals changed (or created) at or after this instant. */
  updatedSince?: Date;
  /** The task-like group, kept for the migration period. */
  legacy?: {
    status?: string;
    board?: string;
    assignedToPersonId?: number;
    /** `dueAt` is before now (a strict instant). */
    overdue?: boolean;
  };
};

export type SignalOrder = 'mostrecent' | 'mostupvoted' | 'mostmessages';

export type SignalRow = {
  id: number;
  slug: string;
  title: string;
  /** `null` when not read (mode `none`); a prefix when `descriptionChars` limits it. */
  description: string | null;
  type: string;
  priority: string;
  tags: unknown;
  messages: number;
  archived: boolean;
  creatorId: number | null;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  status: string;
  board: string;
  assigneeIds: unknown;
  indicativePayouts: unknown;
  capitals: unknown;
  overdue: boolean;
  /** Stored origin kind (#2724); the client id is not read. */
  originKind: string;
  /** Self-declared client name snapshot, or null. */
  originClientLabel: string | null;
};

export type SignalUpvoteRow = {
  coherenceId: number;
  upCount: number;
  downCount: number;
  /** Net raw voting power (up minus down), as a decimal string. */
  totalVotingPower: string;
  tokenDecimals: number;
  /** The viewer's own vote, when the viewer has one. */
  myDirection: 'up' | 'down' | null;
};

export type SignalSummaryRows = {
  total: number;
  byType: Map<string, number>;
  byPriority: Map<string, number>;
  byStatus: Map<string, number>;
  byBoard: Map<string, number>;
  overdue: number;
  unassigned: number;
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
  return [];
}

const list = (values: readonly (string | number)[]): SQL =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

const typeExpr = sql`(case when btrim(c.type) in (${list(
  COHERENCE_TYPES,
)}) then btrim(c.type) else 'Opportunity' end)`;
const priorityExpr = sql`(case when c.priority in (${list(
  COHERENCE_PRIORITIES,
)}) then c.priority else 'medium' end)`;
const statusExpr = sql`coalesce(nullif(btrim(c.progress_status), ''), ${DEFAULT_SIGNAL_PROGRESS_STATUS}::text)`;
const boardExpr = (workflow: SignalWorkflowView): SQL =>
  workflow.boardSlugs.length > 0
    ? sql`(case when btrim(c.board) in (${list(
        workflow.boardSlugs,
      )}) then btrim(c.board) else ${workflow.defaultBoard}::text end)`
    : sql`${workflow.defaultBoard}::text`;
const overdueExpr = sql`(c.due_at is not null and c.due_at < now())`;
const hasAssigneesExpr = sql`(jsonb_typeof(c.assignee_ids) = 'array' and jsonb_array_length(c.assignee_ids) > 0)`;
const tagsArray = sql`(case when jsonb_typeof(c.tags) = 'array' then c.tags else '[]'::jsonb end)`;

const iso = (column: string): SQL =>
  sql.raw(
    `to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
  );
/** `created_at` and `updated_at` are `timestamp` columns written as UTC by the app. */
const isoNaive = (column: string): SQL =>
  sql.raw(`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);

/** The one WHERE of the list, the counts and the summary, so they can never disagree. */
export function buildSignalWhere(
  filter: SignalFilter,
  workflow: SignalWorkflowView,
): SQL {
  const conditions: SQL[] = [sql`c.space_id = ${filter.spaceId}`];
  if (!filter.includeArchived) {
    conditions.push(sql`coalesce(c.archived, false) = false`);
  }
  const q = filter.query?.trim();
  if (q) {
    conditions.push(
      sql`(strpos(lower(c.title), lower(${q})) > 0
        or strpos(lower(c.description), lower(${q})) > 0
        or to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.description, ''))
           @@ plainto_tsquery('english', ${q}))`,
    );
  }
  if (filter.type) conditions.push(sql`${typeExpr} = ${filter.type}`);
  if (filter.priority) {
    conditions.push(sql`${priorityExpr} = ${filter.priority}`);
  }
  const tags = (filter.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);
  if (tags.length > 0) {
    conditions.push(
      sql`exists (select 1 from jsonb_array_elements_text(${tagsArray}) as tg(v)
        where lower(btrim(tg.v)) in (${list(tags)}))`,
    );
  }
  if (filter.createdByPersonId !== undefined) {
    conditions.push(sql`c.creator_id = ${filter.createdByPersonId}`);
  }
  if (filter.updatedSince) {
    conditions.push(
      sql`c.updated_at >= ${filter.updatedSince.toISOString()}::timestamp`,
    );
  }
  const legacy = filter.legacy;
  if (legacy?.status) conditions.push(sql`${statusExpr} = ${legacy.status}`);
  if (legacy?.board) {
    conditions.push(sql`${boardExpr(workflow)} = ${legacy.board}`);
  }
  if (legacy?.assignedToPersonId !== undefined) {
    const asNumber = JSON.stringify([legacy.assignedToPersonId]);
    const asText = JSON.stringify([String(legacy.assignedToPersonId)]);
    conditions.push(
      sql`(c.assignee_ids @> ${asNumber}::jsonb or c.assignee_ids @> ${asText}::jsonb)`,
    );
  }
  if (legacy?.overdue) conditions.push(overdueExpr);
  return sql.join(conditions, sql` and `);
}

/** One page of signals, ordered, with the creator's display name joined in. */
export async function selectSignalsPage(
  { db }: DbConfig,
  args: {
    filter: SignalFilter;
    workflow: SignalWorkflowView;
    order: SignalOrder;
    offset: number;
    limit: number;
    /** `null` = do not read descriptions; a number = read that many leading characters. */
    descriptionChars: number | null | 'all';
  },
): Promise<SignalRow[]> {
  const { filter, workflow, order, offset, limit, descriptionChars } = args;
  const where = buildSignalWhere(filter, workflow);
  const description =
    descriptionChars === null
      ? sql`null::text`
      : descriptionChars === 'all'
      ? sql`c.description`
      : sql`left(c.description, ${descriptionChars})`;
  const upvoteJoin =
    order === 'mostupvoted'
      ? sql`left join (
          select coherence_id,
                 sum(case when direction = 'down' then -abs(voting_power) else abs(voting_power) end) as score
          from coherence_upvotes
          where coherence_id in (select id from coherences where space_id = ${filter.spaceId})
          group by coherence_id
        ) u on u.coherence_id = c.id`
      : sql``;
  const orderBy =
    order === 'mostupvoted'
      ? sql`coalesce(u.score, 0) desc, c.created_at desc, c.id desc`
      : order === 'mostmessages'
      ? sql`coalesce(c.messages, 0) desc, c.created_at desc, c.id desc`
      : sql`c.created_at desc, c.id desc`;

  const result = await db.execute(sql`
    select c.id, c.slug, c.title, ${description} as description,
           ${typeExpr} as type, ${priorityExpr} as priority, c.tags,
           coalesce(c.messages, 0)::int as messages,
           coalesce(c.archived, false) as archived,
           c.creator_id,
           nullif(btrim(concat_ws(' ', p.name, p.surname)), '') as creator_name,
           ${isoNaive('c.created_at')} as created_at,
           ${isoNaive('c.updated_at')} as updated_at,
           ${iso('c.due_at')} as due_at,
           ${statusExpr} as status, ${boardExpr(workflow)} as board,
           c.assignee_ids, c.indicative_payouts, c.capitals,
           ${overdueExpr} as overdue,
           c.origin_kind, c.origin_client_label
    from coherences c
    left join people p on p.id = c.creator_id
    ${upvoteJoin}
    where ${where}
    order by ${orderBy}
    limit ${limit} offset ${offset}
  `);

  return rowsOf(result).map((row) => ({
    id: Number(row.id),
    slug: String(row.slug ?? ''),
    title: String(row.title ?? ''),
    description: row.description == null ? null : String(row.description),
    type: String(row.type),
    priority: String(row.priority),
    tags: row.tags,
    messages: Number(row.messages ?? 0),
    archived: row.archived === true,
    creatorId: row.creator_id == null ? null : Number(row.creator_id),
    creatorName: row.creator_name == null ? null : String(row.creator_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    dueAt: row.due_at == null ? null : String(row.due_at),
    status: String(row.status),
    board: String(row.board),
    assigneeIds: row.assignee_ids,
    indicativePayouts: row.indicative_payouts,
    capitals: row.capitals,
    overdue: row.overdue === true,
    originKind: String(row.origin_kind ?? 'unknown'),
    originClientLabel:
      row.origin_client_label == null ? null : String(row.origin_client_label),
  }));
}

/** The number of signals the filter matches (the `total`), when no summary is wanted. */
export async function countSignals(
  { db }: DbConfig,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
): Promise<number> {
  const where = buildSignalWhere(filter, workflow);
  const result = await db.execute(
    sql`select count(*)::int as n from coherences c where ${where}`,
  );
  return Number(rowsOf(result)[0]?.n ?? 0);
}

/**
 * Counts over the WHOLE filtered set in one scan: the total, by type, by priority, by status,
 * by board, and the overdue and unassigned counts.
 */
export async function summariseSignals(
  { db }: DbConfig,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
): Promise<SignalSummaryRows> {
  const where = buildSignalWhere(filter, workflow);
  const result = await db.execute(sql`
    select grouping(t, pr, st, bd)::int as g, t, pr, st, bd,
           count(*)::int as n,
           (count(*) filter (where is_overdue))::int as overdue_n,
           (count(*) filter (where not has_assignees))::int as unassigned_n
    from (
      select ${typeExpr} as t, ${priorityExpr} as pr, ${statusExpr} as st,
             ${boardExpr(workflow)} as bd,
             ${overdueExpr} as is_overdue, ${hasAssigneesExpr} as has_assignees
      from coherences c
      where ${where}
    ) s
    group by grouping sets ((t), (pr), (st), (bd), ())
  `);
  const out: SignalSummaryRows = {
    total: 0,
    byType: new Map(),
    byPriority: new Map(),
    byStatus: new Map(),
    byBoard: new Map(),
    overdue: 0,
    unassigned: 0,
  };
  for (const row of rowsOf(result)) {
    const n = Number(row.n);
    // `grouping` sets a bit for each column that is NOT part of the set.
    switch (Number(row.g)) {
      case 7:
        out.byType.set(String(row.t), n);
        break;
      case 11:
        out.byPriority.set(String(row.pr), n);
        break;
      case 13:
        out.byStatus.set(String(row.st), n);
        break;
      case 14:
        out.byBoard.set(String(row.bd), n);
        break;
      case 15:
        out.total = n;
        out.overdue = Number(row.overdue_n);
        out.unassigned = Number(row.unassigned_n);
        break;
    }
  }
  return out;
}

/** The most used tags of the filtered set (case-insensitive), most used first. */
export async function selectTopSignalTags(
  { db }: DbConfig,
  filter: SignalFilter,
  workflow: SignalWorkflowView,
  limit: number,
): Promise<{ tag: string; count: number }[]> {
  const where = buildSignalWhere(filter, workflow);
  const result = await db.execute(sql`
    select min(btrim(te.v)) as tag, count(*)::int as n
    from coherences c
    cross join lateral jsonb_array_elements_text(${tagsArray}) as te(v)
    where ${where} and btrim(te.v) <> ''
    group by lower(btrim(te.v))
    order by n desc, lower(btrim(te.v))
    limit ${limit}
  `);
  return rowsOf(result).map((row) => ({
    tag: String(row.tag),
    count: Number(row.n),
  }));
}

/**
 * Vote totals for the given signals (ids that came from rows of the checked space), and the
 * viewer's own vote. Voter identities are not selected.
 */
export async function selectSignalUpvotes(
  { db }: DbConfig,
  coherenceIds: number[],
  viewerPersonId: number | null,
): Promise<Map<number, SignalUpvoteRow>> {
  const out = new Map<number, SignalUpvoteRow>();
  if (coherenceIds.length === 0) return out;
  const result = await db.execute(sql`
    select coherence_id,
           (count(*) filter (where direction is distinct from 'down'))::int as up_n,
           (count(*) filter (where direction = 'down'))::int as down_n,
           coalesce(sum(case when direction = 'down' then -abs(voting_power) else abs(voting_power) end), 0)::text as net,
           coalesce(max(token_decimals), 0)::int as decimals,
           max(case when person_id = ${viewerPersonId} then direction end) as my_direction
    from coherence_upvotes
    where coherence_id in (${list(coherenceIds)})
    group by coherence_id
  `);
  for (const row of rowsOf(result)) {
    const id = Number(row.coherence_id);
    out.set(id, {
      coherenceId: id,
      upCount: Number(row.up_n),
      downCount: Number(row.down_n),
      totalVotingPower: String(row.net),
      tokenDecimals: Number(row.decimals),
      myDirection:
        row.my_direction == null
          ? null
          : row.my_direction === 'down'
          ? 'down'
          : 'up',
    });
  }
  return out;
}

/** Display names (name and surname only) of people, by id. */
export async function selectPersonDisplayNames(
  { db }: DbConfig,
  personIds: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (personIds.length === 0) return out;
  const result = await db.execute(sql`
    select id, nullif(btrim(concat_ws(' ', name, surname)), '') as full_name
    from people
    where id in (${list(personIds)})
  `);
  for (const row of rowsOf(result)) {
    if (row.full_name != null) out.set(Number(row.id), String(row.full_name));
  }
  return out;
}

/** Symbols of tokens known to Hypha, by contract address (lower case). */
export async function selectTokenSymbolsByAddress(
  { db }: DbConfig,
  addresses: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const lower = [...new Set(addresses.map((a) => a.trim().toLowerCase()))];
  if (lower.length === 0) return out;
  const result = await db.execute(sql`
    select distinct on (lower(address)) lower(address) as a, symbol
    from tokens
    where address is not null and lower(address) in (${list(lower)})
    order by lower(address), id
  `);
  for (const row of rowsOf(result)) {
    out.set(String(row.a), String(row.symbol));
  }
  return out;
}
