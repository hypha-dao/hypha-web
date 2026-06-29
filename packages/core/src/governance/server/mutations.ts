import slugify from 'slugify';
import {
  documents,
  tokens,
  tokenUpdates,
} from '@hypha-platform/storage-postgres';
import { eq, sql } from 'drizzle-orm';
import type { InferInsertModel } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

import {
  CreateAgreementInput,
  UpdateAgreementInput,
  UpdateTokenInput,
  CreateTokenUpdateInput,
  TokenUpdateData,
  isTokenUpdateData,
} from '../types';
import type { DatabaseInstance } from '../../common/server/types';
import { findTokenUpdateByDocumentId } from './queries';
import { CreateTokenInput, DeleteTokenInput } from '../types';
import {
  buildUpdateTokenInputPatchFromTokenUpdateData,
  omitUndefinedValues,
} from './token-update-apply';

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
      .where(sql`lower(${tokens.address}) = lower(${address})`)
      .execute();
  } else {
    throw new Error(
      'Either agreementId or agreementWeb3Id or tokenAddress must be provided',
    );
  }

  const lookup =
    agreementId !== undefined
      ? `agreementId: ${agreementId}`
      : agreementWeb3Id !== undefined
      ? `agreementWeb3Id: ${agreementWeb3Id}`
      : `address: ${address}`;

  if (existingToken.length === 0) {
    throw new Error(`No token found with ${lookup}`);
  }

  if (existingToken.length > 1) {
    throw new Error(
      `Multiple tokens found with ${lookup}; refusing ambiguous update`,
    );
  }

  const tokenToUpdate = existingToken[0];
  if (tokenToUpdate === undefined) {
    throw new Error(`No token found with ${lookup}`);
  }

  // Map archiveToken to archived column; omit derived fields not in DB schema
  const { archiveToken, agreementWeb3IdUpdate, ...restWithoutDerivedFields } =
    rest;
  const updateDataRaw = {
    ...restWithoutDerivedFields,
    ...(address !== undefined && { address }),
    ...(agreementWeb3IdUpdate !== undefined && {
      agreementWeb3Id: agreementWeb3IdUpdate,
    }),
    ...(archiveToken !== undefined && { archived: archiveToken }),
  } as Partial<InferInsertModel<typeof tokens>>;

  // Convert referencePrice to string if present
  if (updateDataRaw.referencePrice !== undefined) {
    updateDataRaw.referencePrice = String(updateDataRaw.referencePrice);
  }

  const updateData = omitUndefinedValues(
    updateDataRaw as Record<string, unknown>,
  ) as Partial<InferInsertModel<typeof tokens>>;

  const [updated] = await db
    .update(tokens)
    .set(updateData)
    .where(eq(tokens.id, tokenToUpdate.id))
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
  if (!isTokenUpdateData(data)) {
    throw new Error(
      `Invalid token update JSON for document ${documentId}: data failed validation`,
    );
  }
  const tokenUpdateData: TokenUpdateData = data;

  /**
   * Apply pending JSON with patch semantics: only keys present on `data` update columns.
   * Never overwrite `type` / `is_voting_token` / `agreement_id` / `space_id` / `created_at`
   * from proposal JSON (see `buildUpdateTokenInputPatchFromTokenUpdateData`).
   */
  const patch = buildUpdateTokenInputPatchFromTokenUpdateData(tokenUpdateData);

  const updateInput: UpdateTokenInput = {
    ...patch,
    address: tokenAddress,
  };

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
