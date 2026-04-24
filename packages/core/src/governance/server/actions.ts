'use server';

// TODO: #602 Define RLS Policies for Agreement Table
// import { getDb } from '@hypha-platform/core/server';
import { isAddress } from 'ethers';
import {
  createAgreement,
  updateAgreementBySlug,
  deleteAgreementBySlug,
  createToken,
  updateToken,
  deleteToken,
  createTokenUpdate,
  applyTokenUpdate,
  deleteTokenUpdate,
} from './mutations';
import {
  CreateAgreementInput,
  CreateChangeEntryMethodInput,
  UpdateAgreementBySlugInput,
  UpdateChangeEntryMethodBySlugInput,
  CreateTokenInput,
  UpdateTokenInput,
  DeleteTokenInput,
  CreateTokenUpdateInput,
} from '../types';
// TODO: #602 Define RLS Policies for Agreement Table
import { db } from '@hypha-platform/storage-postgres';
import { normalizeProposalDocumentLabel } from '../proposal-document-label';
import {
  findExchangeDepositEscrowIdsBySpaceId,
  findTokenUpdateByAddress,
  findTokenUpdateByDocumentId,
  findTokenUpdateForSpaceTokenAddress,
} from './queries';

export async function createAgreementAction(
  data: CreateAgreementInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create agreement');
  const label =
    data.label != null && String(data.label).trim() !== ''
      ? normalizeProposalDocumentLabel(data.label)
      : data.label;
  return createAgreement({ ...data, label }, { db });
}

export async function updateAgreementBySlugAction(
  data: UpdateAgreementBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return updateAgreementBySlug(data, { db });
}

export async function deleteAgreementBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteAgreementBySlug(data, { db });
}

/**
 * Return the set of escrow ids that already have an Exchange-Deposit
 * agreement for the given space. Consumed by the space-page deposit banner
 * to hide itself once a proposal has been created and prevent duplicate
 * submissions.
 */
export async function findExchangeDepositEscrowIdsBySpaceIdAction(
  spaceId: number,
): Promise<string[]> {
  return findExchangeDepositEscrowIdsBySpaceId(spaceId, { db });
}

export async function createChangeEntryMethodAction(
  data: CreateChangeEntryMethodInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create agreement');
  return createAgreement({ ...data }, { db });
}

export async function updateChangeEntryMethodBySlugAction(
  data: UpdateChangeEntryMethodBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return updateAgreementBySlug(data, { db });
}

export async function deleteChangeEntryMethodBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteAgreementBySlug(data, { db });
}

export async function createTokenAction(
  input: CreateTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to create token');
  return createToken(input, { db });
}

export async function updateTokenAction(
  input: UpdateTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) {
    console.error('authToken is required to update token');
    throw new Error('authToken is required to update token');
  }

  try {
    const result = await updateToken(input, { db });
    return result;
  } catch (error) {
    console.error('updateTokenAction failed:', error);
    throw error;
  }
}

export async function deleteTokenAction(
  input: DeleteTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to delete token');
  return deleteToken(input, { db });
}

export async function createTokenUpdateAction(
  input: CreateTokenUpdateInput,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to create token update');
  return createTokenUpdate(input, { db });
}

export async function applyTokenUpdateAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to apply token update');
  return applyTokenUpdate(documentId, { db });
}

export async function deleteTokenUpdateAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to delete token update');
  return deleteTokenUpdate(documentId, { db });
}

export async function getTokenUpdateByAddressAction(
  address: string,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to get token update');
  if (!address || !isAddress(address)) {
    throw new Error('Invalid address format');
  }
  return findTokenUpdateByAddress(address, { db });
}

export async function getTokenUpdateByDocumentIdAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to get token update');
  if (!Number.isFinite(documentId) || documentId < 1) {
    throw new Error('Invalid document id');
  }
  return findTokenUpdateByDocumentId(documentId, { db });
}

export async function getTokenUpdateForSpaceTokenAddressAction(
  spaceId: number,
  tokenAddress: string,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to get token update');
  if (!Number.isFinite(spaceId) || spaceId < 1) {
    throw new Error('Invalid space id');
  }
  if (!tokenAddress || !isAddress(tokenAddress)) {
    throw new Error('Invalid address format');
  }
  return findTokenUpdateForSpaceTokenAddress(spaceId, tokenAddress, { db });
}
