'use server';

import slugify from 'slugify';
import { CreateSpaceInput, UpdateSpaceInput } from '../types';
import { eq } from 'drizzle-orm';
import { DatabaseInstance, DbConfig } from '@hypha-platform/core/server';
import { spaces } from '@hypha-platform/storage-postgres';
import { findAllDescendantSpaces } from './queries';

export const createSpace = async (
  { title, slug: maybeSlug, ...rest }: CreateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const slug = maybeSlug || slugify(title, { lower: true });

  const [newSpace] = await db
    .insert(spaces)
    .values({
      title,
      slug,
      ...rest,
    })
    .returning();

  if (!newSpace) {
    throw new Error('Failed to create space');
  }

  return newSpace;
};

export const updateSpaceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const [currentSpace] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);

  if (!currentSpace) {
    throw new Error('Failed to update space: not found');
  }

  if (rest.parentId !== undefined && rest.parentId !== null) {
    const descendants = await findAllDescendantSpaces(
      { spaceId: currentSpace.id },
      { db },
    );
    const descendantIds = descendants.map((d) => d.id);

    if (descendantIds.includes(rest.parentId)) {
      throw new Error(
        'Cannot set parent: the selected space is a descendant of this space, which would create a circular dependency.',
      );
    }

    if (rest.parentId === currentSpace.id) {
      throw new Error('Cannot set parent: a space cannot be its own parent.');
    }
  }

  const [updatedSpace] = await db
    .update(spaces)
    .set(rest)
    .where(eq(spaces.slug, slug))
    .returning();

  if (!updatedSpace) {
    throw new Error('Failed to update space');
  }

  return updatedSpace;
};

export const updateSpaceById = async (
  { id, ...rest }: { id: number } & UpdateSpaceInput,
  config: DbConfig,
) => {
  const { db } = config;
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

    if (rest.parentId !== undefined && rest.parentId !== null) {
      const descendants = await findAllDescendantSpaces(
        { spaceId: id },
        config,
      );
      const descendantIds = descendants.map((d) => d.id);

      if (descendantIds.includes(rest.parentId)) {
        throw new Error(
          'Cannot set parent: the selected space is a descendant of this space, which would create a circular dependency.',
        );
      }

      if (rest.parentId === id) {
        throw new Error('Cannot set parent: a space cannot be its own parent.');
      }
    }

    const [updatedSpace] = await tx
      .update(spaces)
      .set(rest)
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
