import slugify from 'slugify';
import {
  documents,
  tokens,
  tokenUpdates,
} from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import {
  CreateAgreementInput,
  UpdateAgreementInput,
  UpdateTokenInput,
  CreateTokenUpdateInput,
  TokenUpdateData,
} from '../types';
import { DatabaseInstance, findTokenUpdateByDocumentId } from '../../server';
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
      referencePrice: input.referencePrice
        ? String(input.referencePrice)
        : null,
      referenceCurrency: input.referenceCurrency || null,
    })
    .returning();
  return token;
};

export const updateToken = async (
  { agreementId, agreementWeb3Id, address, ...rest }: UpdateTokenInput,
  { db }: { db: DatabaseInstance },
) => {
  let existingToken;
  if (agreementId !== undefined) {
    existingToken = await db
      .select()
      .from(tokens)
      .where(eq(tokens.agreementId, agreementId))
      .execute();
  } else if (agreementWeb3Id !== undefined) {
    existingToken = await db
      .select()
      .from(tokens)
      .where(eq(tokens.agreementWeb3Id, agreementWeb3Id))
      .execute();
  } else if (address !== undefined) {
    existingToken = await db
      .select()
      .from(tokens)
      .where(eq(tokens.address, address))
      .execute();
  } else {
    throw new Error(
      'Either agreementId or agreementWeb3Id or tokenAddress must be provided',
    );
  }

  if (existingToken.length === 0) {
    throw new Error(
      `No token found with ${
        agreementId !== undefined
          ? `agreementId: ${agreementId}`
          : `agreementWeb3Id: ${agreementWeb3Id}`
      }`,
    );
  }

  // Map archiveToken to archived column
  const { archiveToken, ...restWithoutArchive } = rest;
  const updateData = {
    ...restWithoutArchive,
    ...(rest.agreementWeb3IdUpdate !== undefined && {
      agreementWeb3Id: rest.agreementWeb3IdUpdate,
    }),
    ...(archiveToken !== undefined && { archived: archiveToken }),
  } as Partial<InferInsertModel<typeof tokens>>;

  // Convert referencePrice to string if present
  if (updateData.referencePrice !== undefined) {
    updateData.referencePrice = String(updateData.referencePrice);
  }

  const findTokenCondition =
    agreementId !== undefined
      ? eq(tokens.agreementId, agreementId)
      : agreementWeb3Id !== undefined
      ? eq(tokens.agreementWeb3Id, agreementWeb3Id)
      : address !== undefined
      ? eq(tokens.address, address)
      : (() => {
          throw new Error('Unreachable');
        })();

  const [updated] = await db
    .update(tokens)
    .set(updateData)
    .where(findTokenCondition)
    .returning();

  if (!updated) {
    throw new Error('Failed to update token');
  }

  return updated;
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

export const createTokenUpdate = async (
  input: CreateTokenUpdateInput,
  { db }: { db: DatabaseInstance },
) => {
  const [tokenUpdate] = await db
    .insert(tokenUpdates)
    .values({
      documentId: input.documentId,
      tokenAddress: input.tokenAddress,
      data: input.data,
    })
    .returning();
  return tokenUpdate;
};

export const applyTokenUpdate = async (
  documentId: number,
  { db }: { db: DatabaseInstance },
) => {
  const tokenUpdate = await findTokenUpdateByDocumentId(documentId, { db });
  if (!tokenUpdate) {
    throw new Error(`No token update found for document ${documentId}`);
  }

  const { tokenAddress, data } = tokenUpdate;
  const tokenUpdateData = data as TokenUpdateData;

  // Prepare update input, including archiveToken. Omit iconUrl when the pending
  // update did not change the icon so the existing DB value is preserved.
  const updateInput: UpdateTokenInput = {
    address: tokenAddress,
    name: tokenUpdateData.name,
    symbol: tokenUpdateData.symbol,
    maxSupply: tokenUpdateData.maxSupply,
    type: tokenUpdateData.type,
    transferable: tokenUpdateData.transferable,
    isVotingToken: tokenUpdateData.isVotingToken,
    decayInterval: tokenUpdateData.decayInterval,
    decayPercentage: tokenUpdateData.decayPercentage,
    referencePrice: tokenUpdateData.referencePrice,
    referenceCurrency: tokenUpdateData.referenceCurrency,
    archiveToken: tokenUpdateData.archiveToken,
  };
  if (Object.hasOwn(tokenUpdateData, 'iconUrl')) {
    updateInput.iconUrl = tokenUpdateData.iconUrl;
  }

  const updatedToken = await updateToken(updateInput, { db });

  // Delete the token update record after applying
  await db.delete(tokenUpdates).where(eq(tokenUpdates.documentId, documentId));

  return updatedToken;
};

export const deleteTokenUpdate = async (
  documentId: number,
  { db }: { db: DatabaseInstance },
) => {
  await db.delete(tokenUpdates).where(eq(tokenUpdates.documentId, documentId));
};
