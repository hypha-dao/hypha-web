import slugify from 'slugify';
import { CreateSpaceInput, UpdateSpaceInput } from '../types';
import { eq } from 'drizzle-orm';
import { DatabaseInstance } from '@core/_container';
import { spaces } from '@hypha-platform/storage-postgres';

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
