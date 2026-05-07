import { v4 as uuidv4 } from 'uuid';

import { DatabaseInstance } from '../../server';
import {
  CreateCoherenceInput,
  UpdateCoherenceInput,
  UpdateCoherenceSignalInput,
} from '../types';
import { coherences } from '@hypha-platform/storage-postgres';
import { and, eq } from 'drizzle-orm';

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
  const existing = await db
    .select({ id: coherences.id })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const [updatedCoherence] = await db
    .update(coherences)
    .set({ ...rest })
    .where(eq(coherences.id, existing[0]!.id))
    .returning();

  if (!updatedCoherence) {
    throw new Error(`Failed to update coherence for slug="${slug}"`);
  }

  return updatedCoherence;
};

export const updateCoherenceSignalBySlug = async (
  {
    slug,
    requesterPersonId,
    ...rest
  }: { slug: string; requesterPersonId: number } & UpdateCoherenceSignalInput,
  { db }: { db: DatabaseInstance },
) => {
  const { type, priority, title, description, tags } = rest;
  const updated = await db
    .update(coherences)
    .set({ type, priority, title, description, tags })
    .where(
      and(
        eq(coherences.slug, slug),
        eq(coherences.creatorId, requesterPersonId),
      ),
    )
    .returning();

  if (updated.length === 1) {
    return updated[0]!;
  }

  if (updated.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }

  const existing = await db
    .select({ id: coherences.id, creatorId: coherences.creatorId })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  if (existing[0]!.creatorId !== requesterPersonId) {
    throw new Error('Only the signal creator can edit this coherence');
  }

  throw new Error(`Failed to update coherence for slug="${slug}"`);
};

export const deleteCoherenceBySlug = async (
  { slug, requesterPersonId }: { slug: string; requesterPersonId: number },
  { db }: { db: DatabaseInstance },
) => {
  const existing = await db
    .select({ id: coherences.id, creatorId: coherences.creatorId })
    .from(coherences)
    .where(eq(coherences.slug, slug));
  if (existing.length === 0) {
    throw new Error(`Coherence not found for slug="${slug}"`);
  }
  if (existing.length > 1) {
    throw new Error(
      `Multiple coherences found for slug="${slug}", expected exactly one`,
    );
  }
  const row = existing[0]!;
  if (row.creatorId !== requesterPersonId) {
    throw new Error('Only the signal creator can delete this coherence');
  }
  const deleted = await db
    .delete(coherences)
    .where(eq(coherences.id, row.id))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error(`Failed to delete coherence for slug="${slug}"`);
  }

  return deleted[0];
};
