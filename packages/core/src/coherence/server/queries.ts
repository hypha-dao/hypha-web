import { Coherence, coherences } from '@hypha-platform/storage-postgres';
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
  orderBy?: string;
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
        tags ? arrayOverlaps(coherences.tags, tags) : undefined,
        priority ? eq(coherences.priority, priority) : undefined,
      ),
    )
    .orderBy(order);

  return results;
};

export const findCoherencesById = async (
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
