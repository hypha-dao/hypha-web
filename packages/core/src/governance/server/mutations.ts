import slugify from 'slugify';
import { documents, tokens } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import { CreateAgreementInput, UpdateAgreementInput } from '../types';
import { DatabaseInstance } from '../../server';
import { CreateTokenInput, DeleteTokenInput } from '../types';

export const createAgreement = async (
  { title, slug: maybeSlug, creatorId, ...rest }: CreateAgreementInput,
  { db }: { db: DatabaseInstance },
) => {
  if (creatorId === undefined) {
    throw new Error('creatorId is required to create agreement');
  }
  const slug =
    maybeSlug || `${slugify(title, { lower: true })}-${uuidv4().slice(0, 8)}`;

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

export const createToken = async (
  input: CreateTokenInput,
  { db }: { db: DatabaseInstance },
) => {
  const [token] = await db
    .insert(tokens)
    .values({
      agreementId: input.agreementId,
      spaceId: input.spaceId,
      name: input.name,
      symbol: input.symbol,
      maxSupply: input.maxSupply,
      type: input.type,
      iconUrl: input.iconUrl,
      transferable: input.transferable,
      isVotingToken: input.isVotingToken,
      decayInterval: input.decaySettings?.decayInterval,
      decayPercentage: input.decaySettings?.decayPercentage,
    })
    .returning();
  return token;
};

export const deleteToken = async (
  input: DeleteTokenInput,
  { db }: { db: DatabaseInstance },
) => {
  const [deleted] = await db
    .delete(tokens)
    .where(eq(tokens.id, Number(input.id)))
    .returning();
  return deleted;
};
