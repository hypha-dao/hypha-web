import slugify from 'slugify';
import { CreateSpaceInput, UpdateSpaceInput } from '../types';
import { eq } from 'drizzle-orm';
import { DatabaseInstance } from '@core/_container';
import { spaces } from '@hypha-platform/storage-postgres';

export const createSpace = async (
  { title, slug: maybeSlug, description, ...rest }: CreateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const slug = maybeSlug || slugify(title, { lower: true });

  const [newSpace] = await db
    .insert(spaces)
    .values({
      title,
      slug,
      description,
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
    .set({ ...rest })
    .where(eq(spaces.slug, slug))
    .returning();

  if (!updatedSpace) {
    throw new Error('Failed to update space');
  }

  return updatedSpace;
};
