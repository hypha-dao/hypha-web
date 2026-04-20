import { v4 as uuidv4 } from 'uuid';

import { DatabaseInstance } from '../../server';
import { CreateCoherenceInput, UpdateCoherenceInput } from '../types';
import { coherences } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';
import { findSelf } from '../../people/server/queries';
import {
  assertCoherenceDeleteAllowed,
  assertCoherenceUpdateAllowed,
} from './update-authorization';

export const createCoherence = async (
  {
    creatorId,
    spaceId,
    slug: maybeSlug,
    priority: maybePriority,
    ...rest
  }: CreateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  if (creatorId === undefined) {
    throw new Error('creatorId is required to create coherence');
  }
  if (spaceId === undefined) {
    throw new Error('spaceId is required to create coherence');
  }
  const slug = maybeSlug || `coh-${uuidv4().slice(0, 8)}`;
  const priority = maybePriority ?? 'medium';

  const [newSignal] = await db
    .insert(coherences)
    .values({
      creatorId,
      spaceId,
      slug,
      priority,
      ...rest,
    })
    .returning();

  if (!newSignal) {
    throw new Error(
      `Failed to persist coherence for spaceId=${spaceId}, slug="${slug}"`,
    );
  }

  return newSignal;
};

export const updateCoherenceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateCoherenceInput,
  { db }: { db: DatabaseInstance },
) => {
  const existingRows = await db
    .select()
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existingRows.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existingRows.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const existingRow = existingRows[0]!;

  const person = await findSelf({ db });
  if (!person) {
    throw new Error('Authentication required to update coherence');
  }
  await assertCoherenceUpdateAllowed(person, existingRow, rest, { db });

  const [updatedCoherence] = await db
    .update(coherences)
    .set({ ...rest })
    .where(eq(coherences.id, existingRow.id))
    .returning();

  if (!updatedCoherence) {
    throw new Error(`Failed to update coherence for slug="${slug}"`);
  }

  return updatedCoherence;
};

export const deleteCoherenceBySlug = async (
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
) => {
  const existingRows = await db
    .select()
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existingRows.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existingRows.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const existingRow = existingRows[0]!;

  const person = await findSelf({ db });
  if (!person) {
    throw new Error('Authentication required to delete coherence');
  }
  await assertCoherenceDeleteAllowed(person, existingRow, { db });

  const deleted = await db
    .delete(coherences)
    .where(eq(coherences.id, existingRow.id))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error(`Failed to delete coherence for slug="${slug}"`);
  }

  return deleted[0];
};
