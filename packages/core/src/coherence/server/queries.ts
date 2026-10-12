import {
  Coherence,
  coherences,
  spaces,
} from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';
import {
  and,
  arrayOverlaps,
  desc,
  eq,
  isNotNull,
  lte,
  SQL,
  sql,
} from 'drizzle-orm';
import { CoherenceType } from '../coherence-types';
import { CoherenceTag } from '../coherence-tags';
import { CoherencePriority } from '../coherence-priorities';

/** Columns present on both main and the long-lived preview branch. */
const coreCoherenceColumns = {
  id: coherences.id,
  creatorId: coherences.creatorId,
  spaceId: coherences.spaceId,
  title: coherences.title,
  description: coherences.description,
  type: coherences.type,
  priority: coherences.priority,
  slug: coherences.slug,
  roomId: coherences.roomId,
  archived: coherences.archived,
  views: coherences.views,
  messages: coherences.messages,
  tags: coherences.tags,
  dueAt: coherences.dueAt,
  progressStatus: coherences.progressStatus,
  board: coherences.board,
  assigneeIds: coherences.assigneeIds,
  source: coherences.source,
  externalId: coherences.externalId,
  createdAt: coherences.createdAt,
  updatedAt: coherences.updatedAt,
};

function isMissingColumnError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (record.code === '42703') return true;
    if (
      typeof record.message === 'string' &&
      record.message.includes('does not exist') &&
      record.message.toLowerCase().includes('column')
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

function completeCoherenceRow(
  row: Omit<
    Coherence,
    | 'assigneeAcknowledgedAt'
    | 'deadlineNotifyState'
    | 'indicativePayouts'
    | 'leadImage'
    | 'videoUrl'
    | 'attachments'
    | 'sharedWithNetwork'
  >,
): Coherence {
  return {
    ...row,
    assigneeAcknowledgedAt: {},
    deadlineNotifyState: {},
    indicativePayouts: [],
    leadImage: null,
    videoUrl: null,
    attachments: [],
    sharedWithNetwork: false,
  };
}

type FindAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews' | 'mostupvoted';
  progressStatus?: string;
  board?: string;
  assigneeId?: number;
  overdue?: boolean;
};

export const findAllCoherences = async (
  { db }: DbConfig,
  {
    spaceId,
    search,
    type,
    tags,
    priority,
    includeArchived = false,
    orderBy,
    progressStatus,
    board,
    assigneeId,
    overdue,
  }: FindAllCoherencesInput,
) => {
  if (spaceId === undefined) {
    return [] as Coherence[];
  }
  const order = ((orderRaw): SQL => {
    switch (orderRaw) {
      case 'mostrecent':
        return desc(coherences.createdAt);
      case 'mostmessages':
        return desc(coherences.messages);
      case 'mostviews':
        return desc(coherences.views);
      // 'mostupvoted' is resolved by the caller after aggregating upvote
      // summaries; recency is only the SQL-level pre-sort.
      default:
        return desc(coherences.createdAt);
    }
  })(orderBy);
  const where = and(
    eq(coherences.spaceId, spaceId),
    includeArchived ? undefined : eq(coherences.archived, false),
    search
      ? sql`(
              -- Full-text search for exact word matches (highest priority)
              (setweight(to_tsvector('english', ${coherences.title}), 'A') ||
               setweight(to_tsvector('english', ${coherences.description}), 'B')
              ) @@ plainto_tsquery('english', ${search})
              OR
              -- Partial word matching with ILIKE (case-insensitive)
              ${coherences.title} ILIKE ${'%' + search + '%'}
              OR
              ${coherences.description} ILIKE ${'%' + search + '%'}
            )`
      : undefined,
    type ? eq(coherences.type, type) : undefined,
    tags && tags.length > 0 ? arrayOverlaps(coherences.tags, tags) : undefined,
    priority ? eq(coherences.priority, priority) : undefined,
    progressStatus ? eq(coherences.progressStatus, progressStatus) : undefined,
    board ? eq(coherences.board, board) : undefined,
    assigneeId
      ? sql`${coherences.assigneeIds} @> ${JSON.stringify([assigneeId])}::jsonb`
      : undefined,
    overdue
      ? and(isNotNull(coherences.dueAt), lte(coherences.dueAt, new Date()))
      : undefined,
  );

  try {
    return await db.select().from(coherences).where(where).orderBy(order);
  } catch (error) {
    // A full select asks for columns this database may not have yet, which
    // fails the whole list and leaves every filter count at 0.
    if (!isMissingColumnError(error)) throw error;
    const rows = await db
      .select(coreCoherenceColumns)
      .from(coherences)
      .where(where)
      .orderBy(order);
    return rows.map(completeCoherenceRow);
  }
};

export const findCoherenceById = async (
  { id }: { id: number },
  { db }: DbConfig,
): Promise<Coherence | null> => {
  const [coherence] = await db
    .select()
    .from(coherences)
    .where(eq(coherences.id, id));
  return coherence ? coherence : null;
};

type FindCoherenceBySlugInput = {
  slug: string;
};

export const findCoherenceBySlug = async (
  { slug }: FindCoherenceBySlugInput,
  { db }: DbConfig,
): Promise<Coherence | null> => {
  const response = await db.query.coherences.findFirst({
    where: (coherences, { eq }) => eq(coherences.slug, slug),
  });

  if (!response) {
    return null;
  }

  return {
    ...response,
  };
};

/**
 * Resolve a signal previously written by an integration, so a retried POST
 * returns the original record instead of creating a duplicate.
 */
export const findCoherenceBySourceExternalId = async (
  {
    spaceId,
    source,
    externalId,
  }: { spaceId: number; source: string; externalId: string },
  { db }: DbConfig,
): Promise<Coherence | null> => {
  const [row] = await db
    .select()
    .from(coherences)
    .where(
      and(
        eq(coherences.spaceId, spaceId),
        eq(coherences.source, source),
        eq(coherences.externalId, externalId),
      ),
    )
    .limit(1);
  return row ?? null;
};

type CheckCoherenceSlugExistsInput = {
  slug: string;
};

export type CoherenceByRoomIdResult = {
  id: number;
  slug: string;
  title: string;
  roomId: string;
  spaceId: number;
  spaceSlug: string;
};

/** Resolve a signal thread Matrix room to its coherence slug and host space slug. */
export const findCoherenceByRoomId = async (
  { roomId }: { roomId: string },
  { db }: DbConfig,
): Promise<CoherenceByRoomIdResult | null> => {
  const trimmed = roomId.trim();
  if (!trimmed) return null;

  const [row] = await db
    .select({
      id: coherences.id,
      slug: coherences.slug,
      title: coherences.title,
      roomId: coherences.roomId,
      spaceId: coherences.spaceId,
      spaceSlug: spaces.slug,
    })
    .from(coherences)
    .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
    .where(and(eq(coherences.roomId, trimmed), eq(coherences.archived, false)))
    .limit(1);

  if (!row?.slug?.trim() || !row.spaceSlug?.trim() || !row.roomId?.trim()) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug.trim(),
    title: row.title,
    roomId: row.roomId.trim(),
    spaceId: row.spaceId!,
    spaceSlug: row.spaceSlug.trim(),
  };
};

/** Resolve a signal slug to its Matrix room and host space slug. */
export const findCoherenceBySlugWithSpace = async (
  { slug }: FindCoherenceBySlugInput,
  { db }: DbConfig,
): Promise<CoherenceByRoomIdResult | null> => {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  const [row] = await db
    .select({
      id: coherences.id,
      slug: coherences.slug,
      title: coherences.title,
      roomId: coherences.roomId,
      spaceId: coherences.spaceId,
      spaceSlug: spaces.slug,
    })
    .from(coherences)
    .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
    .where(and(eq(coherences.slug, trimmed), eq(coherences.archived, false)))
    .limit(1);

  if (!row?.slug?.trim() || !row.spaceSlug?.trim() || !row.roomId?.trim()) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug.trim(),
    title: row.title,
    roomId: row.roomId.trim(),
    spaceId: row.spaceId!,
    spaceSlug: row.spaceSlug.trim(),
  };
};

export const checkCoherenceSlugExists = async (
  { slug }: CheckCoherenceSlugExistsInput,
  { db }: DbConfig,
): Promise<{ exists: boolean; coherenceId?: number }> => {
  const response = await db.query.coherences.findFirst({
    where: (coherences, { eq }) => eq(coherences.slug, slug),
  });

  const exists = !!response;
  const coherenceId = response?.id;
  return { exists, coherenceId };
};
