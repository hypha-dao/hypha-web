import {
  Coherence,
  coherences,
  spaces,
} from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';
import { and, arrayOverlaps, desc, eq, SQL, sql } from 'drizzle-orm';
import { CoherenceType } from '../coherence-types';
import { CoherenceTag } from '../coherence-tags';
import { CoherencePriority } from '../coherence-priorities';

type FindAllCoherencesInput = {
  spaceId?: number;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews';
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
      default:
        return desc(coherences.createdAt);
    }
  })(orderBy);
  const results = await db
    .select()
    .from(coherences)
    .where(
      and(
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
        tags && tags.length > 0
          ? arrayOverlaps(coherences.tags, tags)
          : undefined,
        priority ? eq(coherences.priority, priority) : undefined,
      ),
    )
    .orderBy(order);

  return results;
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
