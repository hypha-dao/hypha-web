import { v4 as uuidv4 } from 'uuid';

import { DatabaseInstance } from '../../server';
import { CreateCoherenceInput, UpdateCoherenceInput } from '../types';
import { coherences } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

export const createCoherence = async (
  {
    creatorId,
    slug: maybeSlug,
    status: maybeStatus,
    ...rest
  }: CreateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  if (creatorId === undefined) {
    throw new Error('creatorId is required to create coherence');
  }
  const slug = maybeSlug || `coh-${uuidv4().slice(0, 8)}`;
  const status = maybeStatus || 'signal';

  const [newSignal] = await db
    .insert(coherences)
    .values({
      creatorId,
      slug,
      status,
      ...rest,
    })
    .returning();

  if (!newSignal) {
    throw new Error('Failed to create coherence');
  }

  return newSignal;
};

export const updateCoherenceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  const [updatedCoherence] = await db
    .update(coherences)
    .set({ ...rest })
    .where(eq(coherences.slug, slug))
    .returning();

  if (!updatedCoherence) {
    throw new Error('Failed to update coherence');
  }

  return updatedCoherence;
};

export const deleteCoherenceBySlug = async (
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
) => {
  const deleted = await db
    .delete(coherences)
    .where(eq(coherences.slug, slug))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error('Failed to delete coherence');
  }

  return deleted[0];
};
