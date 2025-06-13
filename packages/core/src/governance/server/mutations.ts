import slugify from 'slugify';
import { CreateAgreementInput, UpdateAgreementInput } from '../types';
import { DatabaseInstance } from '@core/_container';
import { documents } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

export const createAgreement = async (
  { title, slug: maybeSlug, creatorId, ...rest }: CreateAgreementInput,
  { db }: { db: DatabaseInstance },
) => {
  if (creatorId === undefined) {
    throw new Error('creatorId is required to create agreement');
  }
  const slug = maybeSlug || slugify(title, { lower: true });

  const [newAgreement] = await db
    .insert(documents)
    .values({
      creatorId,
      title,
      slug,
      ...rest,
    })
    .returning();

  if (!newAgreement) {
    throw new Error('Failed to create agreement');
  }

  return newAgreement;
};

export const updateAgreementBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateAgreementInput,
  { db }: { db: DatabaseInstance },
) => {
  const [updatedAgreement] = await db
    .update(documents)
    .set({ ...rest })
    .where(eq(documents.slug, slug))
    .returning();

  if (!updatedAgreement) {
    throw new Error('Failed to update document');
  }

  return updatedAgreement;
};

export const deleteAgreementBySlug = async (
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
) => {
  const deleted = await db
    .delete(documents)
    .where(eq(documents.slug, slug))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error('Failed to delete agreement');
  }

  return deleted[0];
};
