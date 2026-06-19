'use server';

import slugify from 'slugify';
import {
  buildLocatedAtPatch,
  normalizeSpaceLocationFields,
} from '../../geo/location';
import { CreateSpaceInput, UpdateSpaceInput } from '../types';
import { eq } from 'drizzle-orm';
import { DatabaseInstance } from '@hypha-platform/core/server';
import { spaces } from '@hypha-platform/storage-postgres';

export const createSpace = async (
  { title, slug: maybeSlug, ...rest }: CreateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const slug = maybeSlug || slugify(title, { lower: true });
  const normalizedLocation = normalizeSpaceLocationFields({
    latitude: rest.latitude,
    longitude: rest.longitude,
    locationLabel: rest.locationLabel,
    locationSource: rest.locationSource,
  });
  const locatedAtPatch = buildLocatedAtPatch({
    latitude: normalizedLocation.latitude,
    longitude: normalizedLocation.longitude,
  });

  const [newSpace] = await db
    .insert(spaces)
    .values({
      title,
      slug,
      ...rest,
      ...normalizedLocation,
      ...locatedAtPatch,
    })
    .returning();

  if (!newSpace) {
    throw new Error('Failed to create space');
  }

  return newSpace;
};

function withLocationTimestamp<T extends UpdateSpaceInput>(
  input: T,
): T & { locatedAt?: Date | null } {
  const normalizedLocation = normalizeSpaceLocationFields({
    latitude: input.latitude,
    longitude: input.longitude,
    locationLabel: input.locationLabel,
    locationSource: input.locationSource,
  });
  const locatedAtPatch = buildLocatedAtPatch({
    latitude: normalizedLocation.latitude,
    longitude: normalizedLocation.longitude,
  });
  return {
    ...input,
    ...normalizedLocation,
    ...locatedAtPatch,
  };
}

export const updateSpaceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const [updatedSpace] = await db
    .update(spaces)
    .set(withLocationTimestamp(rest))
    .where(eq(spaces.slug, slug))
    .returning();

  if (!updatedSpace) {
    throw new Error('Failed to update space');
  }

  return updatedSpace;
};

export const updateSpaceById = async (
  { id, ...rest }: { id: number } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  return await db.transaction(async (tx) => {
    const [originalSpace] = await tx
      .select()
      .from(spaces)
      .where(eq(spaces.id, id))
      .offset(0)
      .limit(1);

    if (!originalSpace) {
      throw new Error('Failed to update space: not found');
    }

    const [updatedSpace] = await tx
      .update(spaces)
      .set(withLocationTimestamp(rest))
      .where(eq(spaces.id, id))
      .returning();

    if (!updatedSpace) {
      throw new Error('Failed to update space');
    }

    return { originalSpace, updatedSpace };
  });
};

function hasArchivedSpaceFlag(flags: unknown): boolean {
  return Array.isArray(flags) && flags.includes('archived');
}

/** Atomically archive/reparent children and update space configuration. */
export const updateSpaceConfigurationById = async (
  { id, ...rest }: { id: number } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  return db.transaction(async (tx) => {
    const [originalSpace] = await tx
      .select()
      .from(spaces)
      .where(eq(spaces.id, id))
      .limit(1);

    if (!originalSpace) {
      throw new Error('Failed to update space: not found');
    }

    const nextFlags = rest.flags ?? originalSpace.flags;
    const wasArchived = hasArchivedSpaceFlag(originalSpace.flags);
    const willBeArchived = hasArchivedSpaceFlag(nextFlags);
    const normalizedRest = willBeArchived ? { ...rest, parentId: null } : rest;

    if (!wasArchived && willBeArchived) {
      const reparentTo = originalSpace.parentId ?? null;
      await tx
        .update(spaces)
        .set({ parentId: reparentTo })
        .where(eq(spaces.parentId, id));
    }

    const nextParentId =
      normalizedRest.parentId !== undefined
        ? normalizedRest.parentId
        : originalSpace.parentId;

    if (nextParentId != null && nextParentId === id) {
      throw new Error('A space cannot be its own parent');
    }

    if (
      originalSpace.parentId == null &&
      nextParentId != null &&
      nextParentId !== originalSpace.parentId
    ) {
      await tx
        .update(spaces)
        .set({ parentId: null })
        .where(eq(spaces.id, nextParentId));
    }

    const [updatedSpace] = await tx
      .update(spaces)
      .set(withLocationTimestamp(normalizedRest))
      .where(eq(spaces.id, id))
      .returning();

    if (!updatedSpace) {
      throw new Error('Failed to update space');
    }

    return { originalSpace, updatedSpace };
  });
};

/**
 * Delete a space by slug
 *
 * @param slug - The slug of the space to delete
 * @param db - Database instance
 * @returns Boolean indicating if the deletion was successful
 */
export const deleteSpaceBySlug = async (
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
): Promise<boolean> => {
  try {
    const result = await db
      .delete(spaces)
      .where(eq(spaces.slug, slug))
      .returning();

    return result.length > 0;
  } catch (error) {
    // Silent failure with return value
    return false;
  }
};
